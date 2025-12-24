#!/usr/bin/env node
import { stdin, stdout } from 'node:process';

let data = '';
stdin.setEncoding('utf8');
stdin.on('data', chunk => {
  data += chunk;
});
stdin.on('end', () => {
  stdout.write(`IN:${data}`);
});
