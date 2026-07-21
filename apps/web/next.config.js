const path = require('path');
const { loadEnvConfig } = require('@next/env');

loadEnvConfig(path.join(__dirname, '../..'), process.env.NODE_ENV !== 'production', console, true);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@nera/ui', '@nera/types'],
  // P013A packaging fix (Owner-approved Option B): @nera/database (and every
  // engine package that imports it) is genuine Node ESM ("type": "module")
  // using NodeNext-style relative imports with a ".js" extension pointing at
  // ".ts" source files - a convention webpack's resolver doesn't understand
  // on its own. This tells webpack to also try ".ts"/".tsx" whenever a ".js"
  // extension fails to resolve, without touching @nera/database itself or
  // changing NodeNext anywhere.
  webpack: config => {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.js', '.ts', '.tsx'],
    };
    return config;
  },
};

module.exports = nextConfig;
