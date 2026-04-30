import type { NextConfig } from "next";
import { execSync } from "child_process";

const gitSha = execSync("git rev-parse --short HEAD").toString().trim();
const pkg = require("./package.json");
const appVersion = `${pkg.version}-${gitSha}`;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  headers: async () => [
    {
      source: "/:path*",
      headers: [{ key: "X-App-Version", value: appVersion }],
    },
  ],
};

export default nextConfig;
