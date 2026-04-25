// Single-bundle config (com.brigo.ai). The variant approach (Brigo Dev /
// Brigo Preview installed alongside production) was abandoned because this is
// a bare-workflow project — bundle IDs live in android/app/build.gradle and
// ios/Brigo.xcodeproj/project.pbxproj, not here. EAS warns:
//   "Specified value for android.package in app.config.js is ignored because
//    an android directory was detected in the project."
// To revisit variants later, do native-code surgery: Gradle product flavors
// for Android, Xcode build configurations for iOS. APP_ENV from eas.json
// still flows through to runtime via Constants.expoConfig.extra.appVariant
// in case JS code wants to gate behavior by environment.

const variant = process.env.APP_ENV || 'production';

module.exports = {
  expo: {
    name: 'Brigo',
    slug: 'brigo',
    version: '1.2.5',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    assetBundlePatterns: ['**/*'],
    scheme: 'brigo',
    owner: 'francis.dev',
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.brigo.ai',
      buildNumber: '58',
      usesAppleSignIn: true,
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSCameraUsageDescription: 'This app needs access to your camera to take photos of study materials.',
        NSPhotoLibraryUsageDescription: 'This app needs access to your photo library to upload study materials and images.',
        NSPhotoLibraryAddUsageDescription: 'This app needs permission to save images to your photo library.',
        NSMicrophoneUsageDescription: 'This app needs access to your microphone for audio recording features.',
        UIBackgroundModes: ['audio', 'remote-notification'],
      },
      associatedDomains: ['applinks:brigo.app'],
    },
    android: {
      icon: './assets/icon.png',
      // Adaptive icon foreground: artwork at ~66% scale on a transparent
      // 1024x1024 canvas, so the launcher's circle/squircle mask hugs it
      // cleanly instead of falling back to a flat square. Original edge-to-
      // edge file is preserved at assets/adaptive-icon.original.png.
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#FF9500',
      },
      package: 'com.brigo.ai',
      versionCode: 14,
      googleServicesFile: './google-services.json',
      permissions: [
        'android.permission.CAMERA',
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
        'android.permission.RECORD_AUDIO',
        'android.permission.MODIFY_AUDIO_SETTINGS',
      ],
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: true,
          data: [
            {
              scheme: 'https',
              host: 'brigo.app',
              pathPrefix: '/invite',
            },
          ],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
    },
    web: {
      favicon: './assets/icon.png',
    },
    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        {
          backgroundColor: '#faf9f6',
          image: './assets/splash.png',
          resizeMode: 'contain',
          android: {
            image: './assets/icon.png',
            imageWidth: 288,
            backgroundColor: '#faf9f6',
          },
        },
      ],
      [
        'expo-image-picker',
        {
          photosPermission: 'This app needs access to your photos to upload study materials.',
          cameraPermission: 'This app needs access to your camera to take photos of study materials.',
        },
      ],
      [
        'expo-document-picker',
        {
          iCloudContainerEnvironment: 'Production',
        },
      ],
      [
        'expo-av',
        {
          microphonePermission: 'This app needs access to your microphone for audio features.',
        },
      ],
      [
        '@sentry/react-native/expo',
        {
          organization: 'prepai-nb',
          project: 'react-native',
        },
      ],
      'expo-secure-store',
      'expo-web-browser',
      [
        'expo-notifications',
        {
          icon: './assets/notification-icon.png',
          color: '#FF9500',
        },
      ],
      'expo-localization',
      'expo-audio',
      'expo-font',
      'expo-asset',
      [
        '@react-native-google-signin/google-signin',
        {
          iosUrlScheme: 'com.googleusercontent.apps.192701147934-m3qis098on3dqsstg8qgjq4inopjcvu4',
        },
      ],
    ],
    extra: {
      router: {
        origin: false,
      },
      appVariant: variant,
      eas: {
        projectId: '292f816a-44fc-41b8-9f3f-7c9f5dec3d02',
        build: {
          experimental: {
            ios: {
              appExtensions: [
                {
                  targetName: 'BrigoWidgetExtension',
                  bundleIdentifier: 'com.brigo.ai.BrigoWidget',
                  entitlements: {
                    'com.apple.security.application-groups': ['group.com.brigo.shared'],
                  },
                },
              ],
            },
          },
        },
      },
    },
  },
};
