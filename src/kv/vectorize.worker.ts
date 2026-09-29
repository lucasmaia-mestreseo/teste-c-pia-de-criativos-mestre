/// <reference lib="webworker" />
/**
 * Criação de KVs — vectorization off the main thread (ImageTracer is CPU heavy).
 * Receives ImageData, returns the raw SVG string.
 */
import ImageTracer from 'imagetracerjs';

self.onmessage = (e: MessageEvent<{ id: number; imgd: ImageData; colors: number }>) => {
  const { id, imgd, colors } = e.data;
  try {
    const svg = ImageTracer.imagedataToSVG(imgd, {
      numberofcolors: colors,
      colorquantcycles: 2,
      colorsampling: 2,
      ltres: 1,
      qtres: 1,
      pathomit: 8,
      rightangleenhance: false,
      strokewidth: 0,
      linefilter: true,
      roundcoords: 1,
      viewbox: true,
      blurradius: 0,
    });
    (self as unknown as Worker).postMessage({ id, svg });
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, error: err instanceof Error ? err.message : String(err) });
  }
};
