const path = require('path');
const { loadEnvConfig } = require('@next/env');

loadEnvConfig(path.join(__dirname, '../..'), process.env.NODE_ENV !== 'production', console, true);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@nera/ui', '@nera/types']
};

module.exports = nextConfig;
