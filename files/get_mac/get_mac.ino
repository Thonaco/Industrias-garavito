/*
 * GET MAC ADDRESS - ESP8266
 * -------------------------
 * Sube este sketch primero al ESP8266
 * Abre el Monitor Serial a 115200 baudios
 * Copia la MAC que aparece y pegala en
 * el archivo m5stick_carroza.ino donde dice
 * MAC_CARRO[]
 */

#include <ESP8266WiFi.h>

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n=== MAC ADDRESS DEL ESP8266 ===");
  Serial.print("MAC: ");
  Serial.println(WiFi.macAddress());
  Serial.println("Copia esta MAC al codigo del M5Stick");
  Serial.println("Formato para el array:");
  // Imprimir en formato array de C
  uint8_t mac[6];
  WiFi.macAddress(mac);
  Serial.print("uint8_t MAC_CARRO[] = {");
  for (int i = 0; i < 6; i++) {
    Serial.print("0x");
    if (mac[i] < 16) Serial.print("0");
    Serial.print(mac[i], HEX);
    if (i < 5) Serial.print(", ");
  }
  Serial.println("};");
}

void loop() {
  delay(2000);
  Serial.println("MAC: " + WiFi.macAddress());
}
