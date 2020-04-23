#!/usr/bin/env bash
command -v emcc >/dev/null 2>&1 || { echo "Script requires emcc but it's not installed or in PATH.Aborting." >&2; exit 1; }
cd gsl_wrapper
mkdir -p build
printf "Building GSL wrapper..."
npx tsc pre.ts --outFile build/pre.js
npx tsc post.ts --outFile build/post.js
emcc -o build/gsl_wrapper.js gsl_wrapper.c --pre-js build/pre.js --post-js build/post.js -I ../../wasm_libs/gsl \
    -L../../wasm_libs/gsl/.libs -lm -lgsl -g0 -O2 \
    -L../../wasm_libs/gsl/cblas/.libs -lm -lgslcblas -g0 -O2 \
    -s WASM=1 -s ALLOW_MEMORY_GROWTH=1 \
    -s NO_EXIT_RUNTIME=1 -s EXPORTED_FUNCTIONS='["_filterGaussian", "_malloc", "_free"]' \
    -s EXTRA_EXPORTED_RUNTIME_METHODS='["ccall", "cwrap"]'

printf "Checking for GSL wrapper WASM..."
if [[ $(find build/gsl_wrapper.js -type f -size +10000c 2>/dev/null) ]]; then
    echo "Found"
    # copy WASM module to public folder for serving
    cp build/gsl_wrapper.wasm ../../public/
    # link wrapper to node modules
    mv build/gsl_wrapper.js build/index.js
    cd ../../node_modules
    rm -f gsl_wrapper
    ln -s ../wasm_src/gsl_wrapper/build gsl_wrapper
else
    echo "Not found!"
    exit
fi