---
description: Cómo generar un archivo instalable (APK) para tu móvil y seguir desarrollando
---

# Guía de Construcción con EAS Build

Para tener tu aplicación instalada en el móvil como una app real y poder seguir desarrollándola, usaremos **EAS Build**.

## 1. Preparación (Solo la primera vez)

1.  **Instala las herramientas de Expo**:
    // turbo
    `npm install -g eas-cli`

2.  **Inicia sesión en tu cuenta de Expo**:
    `eas login`

3.  **Configura el proyecto**:
    `eas build:configure`
    *(Selecciona "All" o "Android" cuando te pregunte)*.

## 2. Generar un APK para Probar (Android)

Para generar un archivo que puedas descargar e instalar directamente:

1.  Asegúrate de que tu `eas.json` tenga una configuración para `preview` que genere un APK. Debería verse así:
    ```json
    {
      "build": {
        "preview": {
          "android": {
            "buildType": "apk"
          }
        }
      }
    }
    ```

2.  **Lanza la construcción**:
    `eas build -p android --profile preview`

3.  **Descarga e Instala**: Al terminar, Expo te dará un link o un código QR para descargar el archivo `.apk` e instalarlo en tu móvil.

## 3. Cómo seguir desarrollando

Una vez que tengas la app instalada, puedes seguir trabajando en el código normalmente.

1.  **Desarrollo Local**: Sigue usando `npx expo start` para ver los cambios al instante en tu ordenador o en **Expo Go**.
2.  **Nueva Versión**: Cuando quieras "congelar" tus nuevos avances en un nuevo ejecutable, simplemente vuelve a ejecutar el comando de construcción:
    `eas build -p android --profile preview`

---

> [!TIP]
> Si prefieres probarlo al instante sin generar archivos cada vez, recuerda que puedes usar la app **Expo Go** (disponible en Play Store/App Store) y escanear el código QR que sale al hacer `npx expo start`.
