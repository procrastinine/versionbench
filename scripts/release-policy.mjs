// Packaging and precision variants are artifacts of a release, not new releases.
// Match tokens, so model sizes (4B), dates and native binary/ternary architectures
// remain eligible. A model's weights link may still point to a conversion when
// that is the only documented mirror; the link does not create a release event.
export function artifactExclusion(name) {
  const token =
    /(?:^|[\s/_().-])(?:gguf|ggml|gptq|awq|exl2|exllama2?|mlx|onnx|openvino|coreml|tflite|mlc|hqq|bnb|bitsandbytes|fp(?:4|8|16|32)|bf16|nvfp4|int(?:2|3|4|8)|(?:[2-8]|16|32)[-_ ]?bits?|\d+(?:\.\d+)?bpw|i?q[2-8](?:[_-][a-z0-9]+)*|q[248]f(?:16|32))(?:$|[\s/_().-])/i;
  const packaging = /[-_](?:keras|pytorch|flax|jax|litert|tflite|transformers)(?:$|[-_.])/i;
  const quantized = /(?:^|[\s/_().-])(?:qat|eetq|sfp|w[248]a(?:8|16))(?:$|[\s/_().-])/i;
  return token.test(name) ||
    packaging.test(name) ||
    quantized.test(name) ||
    /quantiz(?:ed|ation|ations)|quantis(?:ed|ation|ations)/i.test(name)
    ? 'Quantization or format conversion; not a separate model release.'
    : null;
}
