import {build} from 'esbuild';
await build({entryPoints:['src/arc-gallery.jsx'],bundle:true,minify:true,format:'esm',target:['es2022'],outfile:'assets/arc-gallery.js',jsx:'automatic',legalComments:'linked'});
console.log('Built the React Bits + GSAP gallery island. The rest of the site remains buildless.');
