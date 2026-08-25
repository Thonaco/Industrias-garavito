/*
 * =====================================================
 *   MINI CARROZA - CONTROLADOR M5STICK PLUS 2
 * =====================================================
 * Hardware: M5Stick-C Plus 2
 * Comunicacion: ESP-NOW (WiFi sin router)
 * IMU: MPU6886 integrado
 *
 * BOTONES:
 *   Btn A (lateral grande) = accion principal
 *   Btn B (lateral pequeño) = accion secundaria
 *   Btn A largo (3s)       = cambiar modo
 *
 * MODO MANUAL:
 *   Sin botones            = avanza solo (crucero)
 *   Mantener Btn A         = gira izquierda
 *   Mantener Btn B         = gira derecha
 *   Btn A + Btn B          = PARA emergencia
 *   Btn B largo (3s)       = retrocede mientras lo sostenés
 *
 * MODO GESTOS (Btn A = gatillo):
 *   Mantener Btn A + inclinar izq  = gira izquierda
 *   Mantener Btn A + inclinar der  = gira derecha
 *   Mantener Btn A + golpe adelante = acelera
 *   Mantener Btn A + golpe atras   = frena/retrocede
 *   Btn A + Btn B (cualquier modo) = PARA emergencia
 * =====================================================
 */

#include <M5StickCPlus2.h>
#include <esp_now.h>
#include <WiFi.h>

// ---- MAC del ESP8266 del carro ----
// CAMBIA ESTO por la MAC real de tu ESP8266
// Para obtenerla, sube el sketch "GetMAC" al ESP8266 primero
uint8_t MAC_CARRO[80:7D:3A:4E:59:5B] = {0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF};

// ---- Comandos que se envian al carro ----
typedef enum {
  CMD_STOP      = 0,
  CMD_AVANZAR   = 1,
  CMD_RETROCEDER= 2,
  CMD_IZQUIERDA = 3,
  CMD_DERECHA   = 4,
  CMD_ACELERAR  = 5   // solo modo gestos
} Comando;

// ---- Modos del controlador ----
typedef enum {
  MODO_MANUAL = 0,
  MODO_GESTOS = 1
} Modo;

// ---- Paquete ESP-NOW ----
typedef struct {
  uint8_t  comando;
  uint8_t  velocidad;   // 0-255
  uint32_t timestamp;
} PaqueteControl;

// ---- Variables globales ----
Modo     modoActual     = MODO_MANUAL;
Comando  ultimoComando  = CMD_AVANZAR;
bool     envioCorrecto  = false;
uint8_t  velocidadCrucero = 180;  // ajusta segun tu carro (0-255)

// Temporizado de botones
unsigned long tiempoPresionA   = 0;
unsigned long tiempoPresionB   = 0;
bool          btnAPresionado   = false;
bool          btnBPresionado   = false;
bool          cambioModoEjecutado = false;
bool          retrocesoEjecutado  = false;

// IMU / gestos
float  accX, accY, accZ;
float  gyrX, gyrY, gyrZ;
unsigned long ultimoGesto = 0;
#define COOLDOWN_GESTO 500   // ms entre gestos
#define UMBRAL_GIRO    0.5   // g para detectar inclinacion
#define UMBRAL_GOLPE   1.8   // g para detectar golpe brusco

// Pantalla
unsigned long ultimaActualizacionPantalla = 0;
#define INTERVALO_PANTALLA 150  // ms

// ---- Callback ESP-NOW ----
void onEnvio(const uint8_t *mac, esp_now_send_status_t status) {
  envioCorrecto = (status == ESP_NOW_SEND_SUCCESS);
}

// ---- Enviar comando al carro ----
void enviarComando(Comando cmd, uint8_t vel = 0) {
  PaqueteControl pkt;
  pkt.comando   = (uint8_t)cmd;
  pkt.velocidad = (vel == 0) ? velocidadCrucero : vel;
  pkt.timestamp = millis();
  esp_now_send(MAC_CARRO, (uint8_t*)&pkt, sizeof(pkt));
  ultimoComando = cmd;
}

// ---- Dibujar pantalla ----
void actualizarPantalla() {
  M5.Lcd.fillScreen(BLACK);
  M5.Lcd.setTextSize(1);

  // Modo activo
  M5.Lcd.setCursor(5, 5);
  if (modoActual == MODO_MANUAL) {
    M5.Lcd.setTextColor(GREEN);
    M5.Lcd.setTextSize(2);
    M5.Lcd.print("MANUAL");
  } else {
    M5.Lcd.setTextColor(CYAN);
    M5.Lcd.setTextSize(2);
    M5.Lcd.print("GESTOS");
  }

  // Comando actual
  M5.Lcd.setCursor(5, 35);
  M5.Lcd.setTextSize(1);
  M5.Lcd.setTextColor(WHITE);
  M5.Lcd.print("Cmd: ");
  switch(ultimoComando) {
    case CMD_STOP:       M5.Lcd.setTextColor(RED);    M5.Lcd.print("STOP");      break;
    case CMD_AVANZAR:    M5.Lcd.setTextColor(GREEN);  M5.Lcd.print("AVANZAR");   break;
    case CMD_RETROCEDER: M5.Lcd.setTextColor(YELLOW); M5.Lcd.print("RETRO");     break;
    case CMD_IZQUIERDA:  M5.Lcd.setTextColor(CYAN);   M5.Lcd.print("IZQ");       break;
    case CMD_DERECHA:    M5.Lcd.setTextColor(CYAN);   M5.Lcd.print("DER");       break;
    case CMD_ACELERAR:   M5.Lcd.setTextColor(ORANGE); M5.Lcd.print("ACELER");    break;
  }

  // Estado conexion
  M5.Lcd.setCursor(5, 55);
  M5.Lcd.setTextColor(WHITE);
  M5.Lcd.print("Link: ");
  if (envioCorrecto) {
    M5.Lcd.setTextColor(GREEN);
    M5.Lcd.print("OK");
  } else {
    M5.Lcd.setTextColor(RED);
    M5.Lcd.print("--");
  }

  // Velocidad crucero
  M5.Lcd.setCursor(5, 75);
  M5.Lcd.setTextColor(WHITE);
  M5.Lcd.print("Vel: ");
  M5.Lcd.print(velocidadCrucero);

  // Instruccion modo
  M5.Lcd.setCursor(5, 100);
  M5.Lcd.setTextColor(DARKGREY);
  M5.Lcd.setTextSize(1);
  if (modoActual == MODO_MANUAL) {
    M5.Lcd.print("A=IZQ B=DER");
    M5.Lcd.setCursor(5, 112);
    M5.Lcd.print("A+B=STOP");
  } else {
    M5.Lcd.print("Manten A+gesto");
    M5.Lcd.setCursor(5, 112);
    M5.Lcd.print("A+B=STOP");
  }

  // Indicador de gatillo activo en modo gestos
  if (modoActual == MODO_GESTOS && btnAPresionado) {
    M5.Lcd.setCursor(5, 128);
    M5.Lcd.setTextColor(YELLOW);
    M5.Lcd.print(">>> ESCUCHANDO");
  }
}

// ---- Leer y procesar IMU para gestos ----
void procesarGestos() {
  // Solo actua si el boton A esta presionado (gatillo)
  if (!btnAPresionado) return;
  // Cooldown entre gestos para no spamear
  if (millis() - ultimoGesto < COOLDOWN_GESTO) return;

  M5.Imu.getAccelData(&accX, &accY, &accZ);
  M5.Imu.getGyroData(&gyrX, &gyrY, &gyrZ);

  Comando gestDetectado = CMD_AVANZAR; // default
  bool hayGesto = false;

  // Golpe hacia adelante (aceleracion en Z positiva brusca)
  if (accZ > UMBRAL_GOLPE) {
    gestDetectado = CMD_ACELERAR;
    hayGesto = true;
  }
  // Golpe hacia atras
  else if (accZ < -UMBRAL_GOLPE) {
    gestDetectado = CMD_RETROCEDER;
    hayGesto = true;
  }
  // Inclinacion izquierda (eje X negativo)
  else if (accX < -UMBRAL_GIRO && abs(accX) > abs(accY)) {
    gestDetectado = CMD_IZQUIERDA;
    hayGesto = true;
  }
  // Inclinacion derecha (eje X positivo)
  else if (accX > UMBRAL_GIRO && abs(accX) > abs(accY)) {
    gestDetectado = CMD_DERECHA;
    hayGesto = true;
  }

  if (hayGesto) {
    enviarComando(gestDetectado);
    ultimoGesto = millis();
    // Vibrar como feedback
    M5.Axp.SetLDOEnable(3, true);
    delay(80);
    M5.Axp.SetLDOEnable(3, false);
  }
}

// ---- Setup ----
void setup() {
  M5.begin();
  M5.Lcd.setRotation(3);
  M5.Lcd.fillScreen(BLACK);
  M5.Lcd.setTextColor(WHITE);
  M5.Lcd.setTextSize(2);
  M5.Lcd.setCursor(10, 50);
  M5.Lcd.print("Iniciando...");

  // Iniciar IMU
  M5.Imu.init();

  // Iniciar WiFi en modo station para ESP-NOW
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();

  // Iniciar ESP-NOW
  if (esp_now_init() != ESP_OK) {
    M5.Lcd.fillScreen(BLACK);
    M5.Lcd.setCursor(5, 50);
    M5.Lcd.setTextColor(RED);
    M5.Lcd.print("ESP-NOW FAIL");
    while(true) delay(1000);
  }

  esp_now_register_send_cb(onEnvio);

  // Registrar el carro como peer
  esp_now_peer_info_t peerInfo = {};
  memcpy(peerInfo.peer_addr, MAC_CARRO, 6);
  peerInfo.channel = 0;
  peerInfo.encrypt = false;
  if (esp_now_add_peer(&peerInfo) != ESP_OK) {
    M5.Lcd.fillScreen(BLACK);
    M5.Lcd.setCursor(5, 50);
    M5.Lcd.setTextColor(RED);
    M5.Lcd.print("PEER FAIL");
    while(true) delay(1000);
  }

  delay(500);
  actualizarPantalla();
}

// ---- Loop principal ----
void loop() {
  M5.update(); // actualiza estado de botones

  unsigned long ahora = millis();

  // ==========================================
  //  LECTURA DE BOTONES
  // ==========================================

  // --- Boton A presionado ---
  if (M5.BtnA.isPressed()) {
    if (!btnAPresionado) {
      btnAPresionado = true;
      tiempoPresionA = ahora;
      cambioModoEjecutado = false;
    }
    // Cambio de modo: A sostenido 3 segundos
    if (!cambioModoEjecutado && (ahora - tiempoPresionA >= 3000)) {
      modoActual = (modoActual == MODO_MANUAL) ? MODO_GESTOS : MODO_MANUAL;
      cambioModoEjecutado = true;
      // Bip de confirmacion
      M5.Axp.SetLDOEnable(3, true); delay(100);
      M5.Axp.SetLDOEnable(3, false); delay(80);
      M5.Axp.SetLDOEnable(3, true); delay(100);
      M5.Axp.SetLDOEnable(3, false);
      enviarComando(CMD_STOP); // para el carro al cambiar modo
    }
  } else {
    if (btnAPresionado) {
      btnAPresionado = false;
      // En modo manual, al soltar A vuelve a avanzar
      if (modoActual == MODO_MANUAL && !cambioModoEjecutado) {
        if (!btnBPresionado) {
          enviarComando(CMD_AVANZAR);
        }
      }
    }
  }

  // --- Boton B presionado ---
  if (M5.BtnB.isPressed()) {
    if (!btnBPresionado) {
      btnBPresionado = true;
      tiempoPresionB = ahora;
      retrocesoEjecutado = false;
    }
    // Retroceso: B sostenido 3 segundos (solo modo manual)
    if (!retrocesoEjecutado && modoActual == MODO_MANUAL
        && (ahora - tiempoPresionB >= 3000)) {
      retrocesoEjecutado = true;
      enviarComando(CMD_RETROCEDER);
    }
  } else {
    if (btnBPresionado) {
      btnBPresionado = false;
      // Al soltar B vuelve a avanzar si no hay retroceso activo
      if (modoActual == MODO_MANUAL && !btnAPresionado) {
        enviarComando(CMD_AVANZAR);
      }
    }
  }

  // ==========================================
  //  LOGICA SEGUN MODO
  // ==========================================

  if (modoActual == MODO_MANUAL) {

    // A + B juntos = STOP emergencia
    if (btnAPresionado && btnBPresionado) {
      enviarComando(CMD_STOP);
    }
    // Solo A = gira izquierda
    else if (btnAPresionado && !btnBPresionado && !cambioModoEjecutado) {
      enviarComando(CMD_IZQUIERDA);
    }
    // Solo B = gira derecha (si no esta en retroceso)
    else if (btnBPresionado && !btnAPresionado && !retrocesoEjecutado) {
      enviarComando(CMD_DERECHA);
    }

  } else { // MODO_GESTOS

    // A + B = STOP emergencia (funciona siempre)
    if (btnAPresionado && btnBPresionado) {
      enviarComando(CMD_STOP);
    }
    // Procesar gestos IMU (solo si A esta presionado como gatillo)
    else {
      procesarGestos();
    }
  }

  // ==========================================
  //  ACTUALIZAR PANTALLA
  // ==========================================
  if (ahora - ultimaActualizacionPantalla >= INTERVALO_PANTALLA) {
    actualizarPantalla();
    ultimaActualizacionPantalla = ahora;
  }

  delay(20); // ~50Hz de polling
}
