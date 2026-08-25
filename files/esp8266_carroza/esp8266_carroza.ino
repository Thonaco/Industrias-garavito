/*
 * =====================================================
 *   MINI CARROZA - CONTROLADOR ESP8266 + L298N
 * =====================================================
 * Hardware: ESP8266 (NodeMCU o Wemos D1 Mini)
 * Motor driver: L298N
 * Motores: 4x Motor TT
 * Sensores: 2x HC-SR04 (anticolision)
 * Comunicacion: ESP-NOW (recibe del M5Stick)
 *
 * PINES L298N -> ESP8266:
 *   ENA  -> D1 (GPIO5)  PWM motor izquierdo
 *   IN1  -> D2 (GPIO4)  dir motor izq A
 *   IN2  -> D3 (GPIO0)  dir motor izq B
 *   IN3  -> D4 (GPIO2)  dir motor der A
 *   IN4  -> D5 (GPIO14) dir motor der B
 *   ENB  -> D6 (GPIO12) PWM motor derecho
 *
 * HC-SR04 IZQUIERDO:
 *   TRIG -> D7 (GPIO13)
 *   ECHO -> D8 (GPIO15)
 *
 * HC-SR04 DERECHO:
 *   TRIG -> RX (GPIO3)
 *   ECHO -> TX (GPIO1)  <- OJO: deshabilita Serial al usarlo
 *
 * ALIMENTACION:
 *   L298N 12V (baterias carro)
 *   L298N 5V salida -> ESP8266 VIN
 *   GND comun entre L298N y ESP8266
 * =====================================================
 */

#include <ESP8266WiFi.h>
#include <espnow.h>

// ==========================================
//  PINES
// ==========================================
#define ENA   5   // D1 - PWM izquierdo
#define IN1   4   // D2
#define IN2   0   // D3
#define IN3   2   // D4
#define IN4  14   // D5
#define ENB  12   // D6 - PWM derecho

// HC-SR04 izquierdo
#define TRIG_IZQ 13  // D7
#define ECHO_IZQ 15  // D8

// HC-SR04 derecho
// Si usas estos pines pierdes el Serial (monitor)
// Recomendado: usar solo el sensor izquierdo en pruebas
// y conectar el derecho cuando ya no necesites debug
#define TRIG_DER  3  // RX
#define ECHO_DER  1  // TX

// ==========================================
//  COMANDOS (deben coincidir con M5Stick)
// ==========================================
#define CMD_STOP       0
#define CMD_AVANZAR    1
#define CMD_RETROCEDER 2
#define CMD_IZQUIERDA  3
#define CMD_DERECHA    4
#define CMD_ACELERAR   5

// ==========================================
//  CONFIGURACION
// ==========================================
#define VEL_CRUCERO      180   // velocidad base (0-255)
#define VEL_GIRO         160   // velocidad al girar
#define VEL_MAX          230   // velocidad maxima
#define DIST_PARAR        20   // cm - frena si hay obstaculo
#define DIST_REDUCIR      40   // cm - reduce velocidad
#define TIMEOUT_CMD      500   // ms sin comando -> para el carro
#define USAR_SONAR_DER  false  // true si conectaste el segundo sensor

// ==========================================
//  VARIABLES
// ==========================================
typedef struct {
  uint8_t  comando;
  uint8_t  velocidad;
  uint32_t timestamp;
} PaqueteControl;

volatile uint8_t  comandoActual   = CMD_STOP;
volatile uint8_t  velocidadActual = VEL_CRUCERO;
volatile bool     hayComandoNuevo = false;
unsigned long     ultimoComando   = 0;

float distanciaIzq = 999;
float distanciaDer = 999;
bool  bloqueadoPorObstaculo = false;

// ==========================================
//  FUNCIONES DE MOTOR
// ==========================================

// Motor izquierdo: IN1/IN2 + ENA
// Motor derecho:   IN3/IN4 + ENB

void motorIzq(int velocidad) {
  // velocidad: -255 a 255. Negativo = retroceso
  if (velocidad > 0) {
    digitalWrite(IN1, HIGH);
    digitalWrite(IN2, LOW);
    analogWrite(ENA, constrain(velocidad, 0, 255));
  } else if (velocidad < 0) {
    digitalWrite(IN1, LOW);
    digitalWrite(IN2, HIGH);
    analogWrite(ENA, constrain(-velocidad, 0, 255));
  } else {
    digitalWrite(IN1, LOW);
    digitalWrite(IN2, LOW);
    analogWrite(ENA, 0);
  }
}

void motorDer(int velocidad) {
  if (velocidad > 0) {
    digitalWrite(IN3, HIGH);
    digitalWrite(IN4, LOW);
    analogWrite(ENB, constrain(velocidad, 0, 255));
  } else if (velocidad < 0) {
    digitalWrite(IN3, LOW);
    digitalWrite(IN4, HIGH);
    analogWrite(ENB, constrain(-velocidad, 0, 255));
  } else {
    digitalWrite(IN3, LOW);
    digitalWrite(IN4, LOW);
    analogWrite(ENB, 0);
  }
}

void pararMotores() {
  motorIzq(0);
  motorDer(0);
}

void avanzar(int vel) {
  motorIzq(vel);
  motorDer(vel);
}

void retroceder(int vel) {
  motorIzq(-vel);
  motorDer(-vel);
}

void girarIzquierda(int vel) {
  // Motor izq hacia atras, motor der hacia adelante
  motorIzq(-vel);
  motorDer(vel);
}

void girarDerecha(int vel) {
  motorIzq(vel);
  motorDer(-vel);
}

void curvearIzquierda(int vel) {
  // Curva suave: der mas rapido que izq
  motorIzq(vel * 0.5);
  motorDer(vel);
}

void curvearDerecha(int vel) {
  motorIzq(vel);
  motorDer(vel * 0.5);
}

// ==========================================
//  SONAR HC-SR04
// ==========================================
float medirDistancia(int pinTrig, int pinEcho) {
  digitalWrite(pinTrig, LOW);
  delayMicroseconds(2);
  digitalWrite(pinTrig, HIGH);
  delayMicroseconds(10);
  digitalWrite(pinTrig, LOW);

  long duracion = pulseIn(pinEcho, HIGH, 30000); // timeout 30ms
  if (duracion == 0) return 999; // sin eco = despejado

  float distancia = duracion * 0.034 / 2.0;
  return distancia;
}

void leerSensores() {
  distanciaIzq = medirDistancia(TRIG_IZQ, ECHO_IZQ);
  if (USAR_SONAR_DER) {
    delay(10); // espera entre mediciones
    distanciaDer = medirDistancia(TRIG_DER, ECHO_DER);
  } else {
    distanciaDer = 999;
  }
}

bool hayObstaculoFrente() {
  return (distanciaIzq < DIST_PARAR || distanciaDer < DIST_PARAR);
}

bool obstaculoCercano() {
  return (distanciaIzq < DIST_REDUCIR || distanciaDer < DIST_REDUCIR);
}

// ==========================================
//  CALLBACK ESP-NOW
// ==========================================
void onRecibir(uint8_t *mac, uint8_t *datos, uint8_t largo) {
  if (largo == sizeof(PaqueteControl)) {
    PaqueteControl *pkt = (PaqueteControl*)datos;
    comandoActual   = pkt->comando;
    velocidadActual = pkt->velocidad;
    ultimoComando   = millis();
    hayComandoNuevo = true;
  }
}

// ==========================================
//  EJECUTAR COMANDO
// ==========================================
void ejecutarComando(uint8_t cmd, uint8_t vel) {
  // Si hay obstaculo al frente, solo permitir retroceder o girar
  if (hayObstaculoFrente() && cmd == CMD_AVANZAR) {
    pararMotores();
    bloqueadoPorObstaculo = true;
    return;
  }
  bloqueadoPorObstaculo = false;

  // Reducir velocidad si hay algo cercano (no obstaculo directo)
  if (obstaculoCercano() && (cmd == CMD_AVANZAR || cmd == CMD_ACELERAR)) {
    vel = vel * 0.6;
  }

  switch(cmd) {
    case CMD_STOP:
      pararMotores();
      break;
    case CMD_AVANZAR:
      avanzar(vel);
      break;
    case CMD_RETROCEDER:
      retroceder(vel);
      break;
    case CMD_IZQUIERDA:
      girarIzquierda(VEL_GIRO);
      break;
    case CMD_DERECHA:
      girarDerecha(VEL_GIRO);
      break;
    case CMD_ACELERAR:
      avanzar(min((int)vel + 40, (int)VEL_MAX));
      break;
  }
}

// ==========================================
//  SETUP
// ==========================================
void setup() {
  Serial.begin(115200);

  // Pines de motor
  pinMode(ENA, OUTPUT); pinMode(IN1, OUTPUT); pinMode(IN2, OUTPUT);
  pinMode(IN3, OUTPUT); pinMode(IN4, OUTPUT); pinMode(ENB, OUTPUT);
  pararMotores();

  // Pines sonar
  pinMode(TRIG_IZQ, OUTPUT); pinMode(ECHO_IZQ, INPUT);
  if (USAR_SONAR_DER) {
    pinMode(TRIG_DER, OUTPUT); pinMode(ECHO_DER, INPUT);
  }

  // WiFi para ESP-NOW
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();

  Serial.print("MAC del carro: ");
  Serial.println(WiFi.macAddress());

  // Iniciar ESP-NOW
  if (esp_now_init() != 0) {
    Serial.println("Error ESP-NOW");
    // Parpadeo de error infinito
    while(true) {
      pararMotores();
      delay(200);
    }
  }

  esp_now_set_self_role(ESP_NOW_ROLE_SLAVE);
  esp_now_register_recv_cb(onRecibir);

  Serial.println("Carro listo, esperando comandos...");

  // Parpadeo de confirmacion: avanza un momento
  avanzar(120); delay(300); pararMotores();
}

// ==========================================
//  LOOP PRINCIPAL
// ==========================================
void loop() {
  unsigned long ahora = millis();

  // Leer sensores cada 80ms
  static unsigned long ultimoSonar = 0;
  if (ahora - ultimoSonar >= 80) {
    leerSensores();
    ultimoSonar = ahora;
  }

  // Timeout: si no hay comandos en TIMEOUT_CMD ms -> para
  if (ahora - ultimoComando > TIMEOUT_CMD && ultimoComando > 0) {
    pararMotores();
    comandoActual = CMD_STOP;
  }

  // Ejecutar comando actual
  if (hayComandoNuevo) {
    hayComandoNuevo = false;
    ejecutarComando(comandoActual, velocidadActual);
  } else if (comandoActual != CMD_STOP) {
    // Re-ejecutar continuamente para mantener motores activos
    // (el L298N no necesita esto, pero mantiene la logica de obstaculo activa)
    ejecutarComando(comandoActual, velocidadActual);
  }

  // Debug cada segundo (desactivar si usas pines RX/TX para sonar)
  static unsigned long ultimoDebug = 0;
  if (ahora - ultimoDebug >= 1000) {
    Serial.print("Cmd:"); Serial.print(comandoActual);
    Serial.print(" Vel:"); Serial.print(velocidadActual);
    Serial.print(" DIzq:"); Serial.print(distanciaIzq);
    Serial.print("cm DDer:"); Serial.print(distanciaDer);
    Serial.print("cm Bloq:"); Serial.println(bloqueadoPorObstaculo);
    ultimoDebug = ahora;
  }

  delay(10);
}
