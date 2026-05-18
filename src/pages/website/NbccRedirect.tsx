import { useEffect } from 'react';

export default function NbccRedirect() {
  useEffect(() => {
    window.location.replace('/?utm_source=nbcc&utm_medium=print&utm_campaign=magazine_may2026');
  }, []);
  return null;
}
