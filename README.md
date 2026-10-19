# Watch Weather – Android 4.0+ (v2.2)

Aplicație Android nativă (WebView), fără biblioteci externe. Rulează pe Android 4.0 și mai nou.

## Funcții
- Ecran 1280×720 landscape, scalat proporțional
- Ceas ⇄ Pitești la 20 s; Valea Mare / Arefu doar din butoanele de locație
- Prognoză pe ore (derulare orizontală) + buton „Zile următoare” (7 zile)
- Buton mare „⟳ Actualizează”
- Buton ✕ mai mare pe ambele ecrane – închide aplicația la prima apăsare
- Open-Meteo, actualizare la 15 min, la revenirea în aplicație și la revenirea internetului
- Date salvate offline + „Offline data” și ora ultimei actualizări
- Ecranul rămâne aprins doar cât timp aplicația e deschisă

## Build pe GitHub
Încărcați toate fișierele în rădăcina repository-ului, inclusiv `.github/workflows/build-apk.yml`.
Actions → Build Android APK → ✅ → Artifacts → watch-weather-apk → app-debug.apk

## Structura
```
.github/workflows/build-apk.yml
settings.gradle
build.gradle
gradle.properties
app/build.gradle
app/src/main/AndroidManifest.xml
app/src/main/res/values/strings.xml
app/src/main/java/ro/pitesti/watchweather/MainActivity.java
app/src/main/java/ro/pitesti/watchweather/Tls12SocketFactory.java
app/src/main/assets/www/index.html
app/src/main/assets/www/style.css
app/src/main/assets/www/app.js
```
