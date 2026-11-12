exports.help = function() {
  return 'Alphabetic-numeric string with length field (1-2 bytes, binary value)';
};

exports.unpack = function(msg, packager) {
  let lengthBytes;
  let length;

  // LL mode - read 1 byte binary length
  if (packager.length <= 99) {
    lengthBytes = 1;
    length = msg.readUInt8(0);  // Direct binary read
  // LLL mode - read 2 bytes binary length
  } else {
    lengthBytes = 2;
    length = msg.readUInt16BE(0);  // Direct binary read
  }

  if (length > packager.length) {
    length = packager.length;
  }

  return {
    data:       msg.slice(lengthBytes, length + lengthBytes),
    chunk:      msg.slice(0, length + lengthBytes),
    restData:   msg.slice(length + lengthBytes)
  };
};
exports.pack = function(row, packager) {
  let lengthBytes;

  // LL mode - BINARY length (1 byte)
  if (packager.length <= 99) {
    lengthBytes = 1;
  // LLL mode - BINARY length (2 bytes)
  } else {
    lengthBytes = 2;
  }

  if (typeof row != 'object') {
    row = Buffer.from('' + row);
  }

  var length = row.length;

  if (length > packager.length) {
    length = packager.length;
    row = row.slice(0, packager.length);
  }

  // Create binary length buffer CORRECTLY
  let lengthBuffer;
  if (lengthBytes === 1) {
    lengthBuffer = Buffer.alloc(1);
    lengthBuffer.writeUInt8(length, 0);
  } else {
    lengthBuffer = Buffer.alloc(2);
    lengthBuffer.writeUInt16BE(length, 0);
  }

  return {
    msg: Buffer.concat([lengthBuffer, row], row.length + lengthBuffer.length),
    data: row
  }
};