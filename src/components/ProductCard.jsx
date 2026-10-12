import ProductPhoto from "./ProductPhoto"

function ProductCard({ producto, onAdd, wasJustAdded }) {
  return (
    <div className="bg-zinc-800 rounded-2xl overflow-hidden shadow-lg border border-zinc-700">
      <ProductPhoto
        src={producto.imagen}
        fallback={producto.originalImage}
        alt={producto.nombre}
        className="w-full h-48 object-cover"
      />

      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-bold text-white">
            {producto.nombre}
          </h2>
          <span className="text-xs uppercase tracking-[0.2em] text-zinc-400">
            {producto.categoria}
          </span>
        </div>

        <p className="text-orange-400 text-lg font-semibold">
          ${producto.precio}
        </p>

        <button
          onClick={onAdd}
          type="button"
          className={`mt-4 w-full rounded-xl py-2 font-semibold text-white transition duration-150 active:scale-95 ${
            wasJustAdded
              ? "bg-green-500"
              : "bg-orange-500 hover:bg-orange-600 active:bg-orange-700"
          }`}
        >
          {wasJustAdded ? "✓ Listo, agregado" : "Agregar"}
        </button>
      </div>
    </div>
  )
}

export default ProductCard
