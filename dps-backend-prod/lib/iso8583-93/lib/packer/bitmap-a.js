exports.help = function() {
  return 'Binary mask (binary encoded)';
};

exports.unpack = function(msg, packager) {
  let chunk = null;
  let data = '', bitmap = '';
  let step = 1;
  let hasMoreChunks = true;
  let chunkNumber = 0;

  while (hasMoreChunks) {
    for (let i = 0; i < packager.length / 2; i++) {
      chunk = msg.slice(i + (chunkNumber * 16), i + step + (chunkNumber * 16)).toString('ascii');

      chunkBitmap = parseInt(chunk, 16).toString(2);

      while (chunkBitmap.length < 4) {
        chunkBitmap = '0' + chunkBitmap;
      }

      data += chunk;
      data = data.toUpperCase();
      bitmap += chunkBitmap;
    }

    if (bitmap.substr(0 + chunkNumber * 64, 1) != 1) hasMoreChunks = false;
    chunkNumber ++;
  }

  return {
    data: data,
    hex: data,
    bitmap: bitmap,
    restData: msg.slice(chunkNumber * 16)
  };
};

exports.pack = function(data, packager) {
  return {
    msg: data,
  };
};
