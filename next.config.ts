import type { NextConfig } from "next";
import { execSync } from "child_process";
import createNextIntlPlugin from "next-intl/plugin";

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

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");
export default withNextIntl(nextConfig);
