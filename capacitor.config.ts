import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.musicreps.app",
  appName: "Music Reps",
  webDir: "docs",
  ...(process.env.CAP_DEV && {
    server: {
      url: `http://192.168.4.45:${process.env.CAP_DEV}`,
      cleartext: true,
    },
  }),
};

export default config;
