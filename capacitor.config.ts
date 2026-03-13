import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.musicreps.app",
  appName: "Music Reps",
  webDir: "docs",
  ...(process.env.CAP_DEV_PORT && {
    server: {
      url: `http://${process.env.CAP_DEV_HOST ?? "localhost"}:${process.env.CAP_DEV_PORT}`,
      cleartext: true,
    },
  }),
};

export default config;
