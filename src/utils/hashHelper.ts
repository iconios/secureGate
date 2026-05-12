import bcrypt from 'bcrypt';

export const hashString = async (str: string): Promise<string> => {
  const saltRounds = 10;
  return await bcrypt.hash(str, saltRounds);
};

export const compareString = async (str: string, hash: string): Promise<boolean> => {
  return await bcrypt.compare(str, hash);
};
