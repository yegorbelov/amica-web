#include <cstdlib>
#include <cstring>
#include <vector>

#include <emscripten/emscripten.h>

#define STB_IMAGE_IMPLEMENTATION
#include "stb_image.h"
#define STB_IMAGE_WRITE_IMPLEMENTATION
#include "stb_image_write.h"

namespace {

void write_callback(void* context, void* data, int size) {
  auto* vec = static_cast<std::vector<uint8_t>*>(context);
  const auto old = vec->size();
  vec->resize(old + static_cast<size_t>(size));
  std::memcpy(vec->data() + old, data, static_cast<size_t>(size));
}

}  // namespace

extern "C" {

EMSCRIPTEN_KEEPALIVE
uint8_t* compress_image(const uint8_t* inp, int in_len, int quality, int* out_len) {
  if (!inp || in_len <= 0 || !out_len) {
    return nullptr;
  }
  *out_len = 0;
  if (quality < 1) {
    quality = 1;
  }
  if (quality > 100) {
    quality = 100;
  }

  int w = 0;
  int h = 0;
  int channels = 0;
  unsigned char* pixels =
      stbi_load_from_memory(inp, in_len, &w, &h, &channels, 3);
  if (!pixels || w <= 0 || h <= 0) {
    return nullptr;
  }

  std::vector<uint8_t> out;
  const int ok = stbi_write_jpg_to_func(
      write_callback, &out, w, h, 3, pixels, quality);
  stbi_image_free(pixels);

  if (!ok || out.empty()) {
    return nullptr;
  }

  void* buf = std::malloc(out.size());
  if (!buf) {
    return nullptr;
  }
  std::memcpy(buf, out.data(), out.size());
  *out_len = static_cast<int>(out.size());
  return static_cast<uint8_t*>(buf);
}

EMSCRIPTEN_KEEPALIVE
void free_compress_buffer(uint8_t* p) {
  std::free(p);
}

}  // extern "C"
