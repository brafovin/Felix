# 🌆 Liberty Shores — Open-World-Prototyp

Ein von **GTA** inspiriertes 3D-Open-World-Spiel, das komplett im **Browser** läuft
(JavaScript + [Three.js](https://threejs.org), WebGL). Kein Build, keine Installation,
keine Spiele-Engine nötig — einfach starten und spielen.

> ⚠️ **Realistische Einordnung:** Das ist ein spielbarer *Prototyp*, kein fertiges AAA-Spiel.
> Ein echtes GTA 6 wird von hunderten Leuten über Jahre gebaut. Dieses Projekt zeigt
> die Kern-Systeme (Open World, Autos, Waffen, Missionen, Tuning) als solide, erweiterbare Basis.

## ✨ Features

- 🏙️ **Open World** — befahrbare Stadt mit Straßenraster, Hochhäusern (mit Fenstern),
  Park, Bäumen, **Strandpromenade mit Palmen & Sonnenschirmen** und **animiertem Meer mit Wellen**.
- 🚗 **Autos** — 4 Fahrzeugtypen mit echter Fahrphysik (Beschleunigung, Lenkung,
  Handbremse, Kollision). Ein- und Aussteigen per Tastendruck.
- 🔧 **Tuner-Garage** — Fahrzeuge individualisieren: **Lackfarbe**, **Motor (Topspeed)**,
  **Getriebe (Beschleunigung)**, **Handling** und **Nitro-Boost** — alles gegen Ingame-Geld.
- 🔫 **Waffen** — Faust & Pistole, Schießen mit Raycast-Treffererkennung und Mündungsspur.
- 🧍 **Charaktere / NPCs** — Fußgänger laufen umher, fliehen bei Beschuss; feindliche
  Gangmitglieder greifen an.
- 🎯 **Missionen** — 3 Missionstypen: Ziel erreichen, Gegner ausschalten, Fahrzeug abliefern.
  Mit Belohnungen, Markern in der Welt und Fortschrittsanzeige.
- 🚓 **Polizei & Verfolgung** — steigt dein Fahndungslevel (Sterne), rücken Polizeiautos
  mit Blaulicht an, verfolgen dich und schießen. Mehr Sterne = mehr Streifen.
  Schüttelst du sie ab, sinken die Sterne. Cops abschießen erhöht die Fahndung.
- 🔊 **Sound & Musik** — komplett prozedural über die Web Audio API (offline, ohne Dateien):
  Schüsse, Treffer, Motorengeräusch (tonhöhenabhängig), Polizeisirene, Erfolgs-Jingle
  und eine entspannte Hintergrundmusik. Stummschalten mit **P**.
- 🗺️ **HUD** — Geld, Leben, Panzerung, Tacho, Fahndungslevel (Sterne),
  **Minimap** und große Karte (Taste **M**).
- 🌅 **Grafik** — filmisches Tone-Mapping (ACES), **Bloom** (leuchtende Fenster, Scheinwerfer,
  Sonne), **Verlaufs-Himmel** mit Sonnenscheibe, **Reflexions-Umgebung** (glänzende Autos & Wasser),
  prozedural texturierter Boden, dynamische Schatten und atmosphärischer Nebel.

## ▶️ Starten

Wegen ES-Module muss das Spiel über einen kleinen Webserver laufen (nicht per Doppelklick):

```bash
# im Projektordner:
python3 -m http.server 8099
```

Dann im Browser öffnen: **http://localhost:8099**

> Three.js liegt lokal unter `vendor/` — das Spiel braucht **keine Internetverbindung**.

## 🎮 Steuerung

| Taste | Aktion |
|-------|--------|
| **W A S D** | Bewegen / Fahren |
| **Maus** | Umsehen |
| **Linksklick** | Schießen |
| **F** | Auto betreten / verlassen |
| **Shift** | Sprinten / Nitro-Boost |
| **Leertaste** | Springen / Handbremse |
| **1 / 2** | Faust / Pistole |
| **E** | Interagieren (Garage / Mission starten) |
| **M** | Große Karte |
| **P** | Ton an / aus |
| **Esc** | Maus freigeben |

## 🗂️ Projektstruktur

```
index.html        # Einstieg, HUD, Menü, Overlays
css/style.css     # Gesamtes UI-Styling
vendor/           # Three.js (lokal, offline)
js/
  main.js         # Spielkern: Schleife, Kamera, Steuerung, Zusammenspiel
  world.js        # Terrain, Wasser, Strand, Straßen, Gebäude, Kollision
  player.js       # Charakter zu Fuß
  vehicles.js     # Fahrzeuge, Fahrphysik, Tuning-Werte
  weapons.js      # Waffen, Raycast-Schüsse
  npc.js          # Fußgänger & feindliche KI
  missions.js     # Missions-Manager mit Markern & Zielen
  police.js       # Polizei-Einheiten, Verfolgungs-KI, Blaulicht
  audio.js        # Prozeduraler Sound & Musik (Web Audio API)
  tuner.js        # Garage-Overlay
  hud.js          # HUD & Minimap-Rendering
  input.js        # Tastatur/Maus
  utils.js        # Hilfsfunktionen
```

## 🚀 Ideen zum Erweitern

- Mehr Missionen & eine Story-Kette
- Mehr Waffen, Fahrzeuge, Boote fürs Wasser
- Speichern/Laden des Fortschritts (localStorage)
- Fahndungs-Eskalation: Straßensperren, Hubschrauber, SWAT

Viel Spaß in **Liberty Shores**! 🏖️
