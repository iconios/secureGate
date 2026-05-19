import { customAlphabet } from 'nanoid';

export const generateUniqueCode = (): string => {
  // 1. Define your alphanumeric character set
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

// 2. Create a custom nanoid generator with a fixed length of 6
const generateAlphanumericId = customAlphabet(alphabet, 6);

// 3. Generate the ID
const uniqueCode = generateAlphanumericId();
console.log('Generated unique code:', uniqueCode); // Debug log to verify code generation
return uniqueCode;
}