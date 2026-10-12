export default function ProductPhoto({ src, fallback, alt, className }) {
  return <img src={src} alt={alt} className={className} loading="lazy" decoding="async"
    onError={(event) => {
      // Una pestaña antigua puede conservar la URL de una foto ya reemplazada.
      if (fallback && event.currentTarget.getAttribute('src') !== fallback) event.currentTarget.src = fallback
    }} />
}
