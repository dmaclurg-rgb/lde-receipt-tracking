import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfkit (audit-packet PDF export) loads its .afm font metrics from disk
  // at runtime via a relative path — Next's server bundler breaks that by
  // tracing/rewriting the module. Excluding it from bundling keeps it a
  // plain node_modules require, where that relative path resolves fine.
  serverExternalPackages: ["pdfkit"],
};

export default nextConfig;
