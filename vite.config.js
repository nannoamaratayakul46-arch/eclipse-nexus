const path = require("node:path");
const { defineConfig } = require("vite");

module.exports = defineConfig({
  publicDir: false,
  build: {
    outDir: path.resolve(__dirname, "public/assets"),
    emptyOutDir: true,
    sourcemap: false,
    minify: "esbuild",
    rollupOptions: {
      input: path.resolve(__dirname, "public/companion.js"),
      output: {
        format: "es",
        inlineDynamicImports: true,
        entryFileNames: "companion.bundle.js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]"
      }
    }
  }
});
