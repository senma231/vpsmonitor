import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ArcoResolver } from 'unplugin-vue-components/resolvers'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    
    // 自动导入Vue API
    AutoImport({
      imports: [
        'vue',
        'vue-router',
        'pinia'
      ],
      dts: true,
      eslintrc: {
        enabled: true
      }
    }),
    
    // 自动导入组件
    Components({
      resolvers: [
        ArcoResolver({
          sideEffect: true
        })
      ],
      dts: true
    })
  ],
  
  // 路径别名
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '~': resolve(__dirname, 'src'),
      'components': resolve(__dirname, 'src/components'),
      'views': resolve(__dirname, 'src/views'),
      'utils': resolve(__dirname, 'src/utils'),
      'stores': resolve(__dirname, 'src/stores'),
      'assets': resolve(__dirname, 'src/assets')
    }
  },
  
  // 开发服务器配置
  server: {
    host: '0.0.0.0',
    port: 3000,
    open: true,
    cors: true,
    proxy: {
      // 代理API请求到Workers开发服务器
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
        secure: false
      },
      '/ws': {
        target: 'ws://localhost:8787',
        ws: true,
        changeOrigin: true
      }
    }
  },
  
  // 构建配置
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    },
    rollupOptions: {
      output: {
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
        manualChunks: {
          // 将Vue相关库打包到vendor chunk
          vendor: ['vue', 'vue-router', 'pinia'],
          // 将UI库单独打包
          arco: ['@arco-design/web-vue'],
          // 将图表库单独打包
          charts: ['echarts', 'vue-echarts'],
          // 将工具库单独打包
          utils: ['axios', 'dayjs', 'lodash-es']
        }
      }
    },
    // 设置chunk大小警告限制
    chunkSizeWarningLimit: 1000
  },
  
  // 环境变量配置
  define: {
    __VUE_OPTIONS_API__: true,
    __VUE_PROD_DEVTOOLS__: false,
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString())
  },
  
  // CSS配置
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `
          @import "@/assets/styles/variables.scss";
          @import "@/assets/styles/mixins.scss";
        `
      }
    },
    modules: {
      localsConvention: 'camelCase'
    }
  },
  
  // 优化配置
  optimizeDeps: {
    include: [
      'vue',
      'vue-router',
      'pinia',
      '@arco-design/web-vue',
      'axios',
      'dayjs',
      'echarts',
      'vue-echarts'
    ]
  },
  
  // 预览服务器配置
  preview: {
    host: '0.0.0.0',
    port: 4173,
    open: true
  },
  
  // 实验性功能
  experimental: {
    renderBuiltUrl(filename, { hostType }) {
      if (hostType === 'js') {
        return { js: `/${filename}` }
      } else {
        return { relative: true }
      }
    }
  },
  
  // 环境变量前缀
  envPrefix: 'VITE_',
  
  // 基础路径 (Cloudflare Pages部署时可能需要调整)
  base: '/',
  
  // 静态资源处理
  assetsInclude: ['**/*.md'],
  
  // 日志级别
  logLevel: 'info',
  
  // 清除控制台
  clearScreen: false
})
