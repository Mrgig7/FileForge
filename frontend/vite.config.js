import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false, // Disable for production (smaller bundle)
    minify: 'esbuild', // Use esbuild for fast minification (default)
    // Chunk splitting for better caching
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunk - React core
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Three.js and 3D related - largest chunk
          'vendor-three': ['three', '@react-three/fiber', '@react-three/drei', '@react-three/postprocessing'],
          // Animation libraries
          'vendor-animation': ['framer-motion', 'framer-motion-3d'],
          // PDF and document handling
          'vendor-pdf': ['react-pdf', 'highlight.js'],
          // Other utilities
          'vendor-utils': ['axios', 'qrcode.react'],
        },
        // Optimize chunk file names
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
      },
    },
    // Performance optimizations
    target: 'esnext', // Modern browsers only
    cssCodeSplit: true, // Split CSS per chunk
    reportCompressedSize: false, // Faster builds
  },
  // Optimize dependencies pre-bundling
  optimizeDeps: {
    include: [
      'react', 
      'react-dom', 
      'react-router-dom',
      'three',
      '@react-three/fiber',
      '@react-three/drei',
      'framer-motion',
    ],
    exclude: ['@react-three/postprocessing'], // Exclude to avoid issues
  },
  // Enable esbuild optimizations
  esbuild: {
    legalComments: 'none', // Remove license comments
    treeShaking: true,
  },
})
