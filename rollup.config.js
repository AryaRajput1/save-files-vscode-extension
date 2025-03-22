const vue = require('rollup-plugin-vue');
const resolve = require('@rollup/plugin-node-resolve');
const commonjs = require('@rollup/plugin-commonjs');
const { terser } = require('rollup-plugin-terser');
const typescript = require('@rollup/plugin-typescript');
const replace = require('@rollup/plugin-replace');
const path = require('path');
const fs = require('fs');
const postcss = require('rollup-plugin-postcss');

const production = !process.env.ROLLUP_WATCH;

module.exports = fs
  .readdirSync(path.join(__dirname, 'webviews', 'pages'))
  .map((input) => {
    const name = input.split('.')[0];
    return {
      input: `webviews/pages/${input}`,
      output: {
        sourcemap: true,
        format: 'iife',
        name: 'app',
        file: `out/compiled/${name}.js`,
      },
      plugins: [
        replace({
          'process.env.ROLLUP_WATCH': JSON.stringify(process.env.ROLLUP_WATCH || 'false'),
          'process.env.NODE_ENV': JSON.stringify(production ? 'production' : 'development'), // Add this line
          preventAssignment: true,
        }),
        vue({
          css: true, // Ensure CSS is extracted and handled correctly
          compileTemplate: true,
          // If you're using scoped styles, make sure to handle them correctly
        }),
        resolve({
          browser: true,
          dedupe: ['vue'],
        }),
        commonjs(),
        typescript({
          tsconfig: 'webviews/tsconfig.json',
          sourceMap: !production,
          inlineSources: !production,
        }),
        production && terser(),
        postcss({
          extract: true, // Extract the CSS into a separate file
          minimize: production, // Minify CSS in production
          sourceMap: !production, // Add source maps if not in production
        }),
      ],
      watch: {
        clearScreen: false,
      },
    };
  });
