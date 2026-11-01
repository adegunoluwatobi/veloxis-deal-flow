export const packShareUrl = (token: string) => {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new Error('Invalid pack token');
  return `https://app.veloxis.co.uk/pack-share.html#token=${token}`;
};