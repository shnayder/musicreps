import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.musicreps.app',
  appName: 'Music Reps',
  webDir: 'docs',
  ios: {
    backgroundColor: '#ffffff',
  },
  ...(process.env.CAP_LOCAL
    ? {}
    : {
        server: {
          url: process.env.CAP_DEV_PORT
            ? `http://${process.env.CAP_DEV_HOST ?? 'localhost'}:${process.env.CAP_DEV_PORT}`
            : 'https://shnayder.github.io/musicreps/',
        },
      }),
};

export default config;
