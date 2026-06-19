import { useMemo, useRef, useState } from "react"

import Cart from "./components/Cart"
import ProductCard from "./components/ProductCard"
import { productos } from "./data/productos"

// const WHATSAPP_NUMBER = "5493513200735" // Activar al publicar la recepción de pedidos.

function App() {
  const [cart, setCart] = useState([])
  const [customerName, setCustomerName] = useState("")
  const [orderNotes, setOrderNotes] = useState("")
  const [deliveryMethod, setDeliveryMethod] = useState("Retiro en el local")
  const [deliveryAddress, setDeliveryAddress] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("Efectivo")
  const [cashAmount, setCashAmount] = useState("")
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [showCartNotifier, setShowCartNotifier] = useState(false)
  const [recentlyAddedProductId, setRecentlyAddedProductId] = useState(null)
  const [shareFeedback, setShareFeedback] = useState("")
  const cartRef = useRef(null)
  const notificationTimeoutRef = useRef(null)
  const addedFeedbackTimeoutRef = useRef(null)
  const shareFeedbackTimeoutRef = useRef(null)

  const categorias = useMemo(() => {
    const uniqueCategories = Array.from(new Set(productos.map((producto) => producto.categoria)))
    const prioritized = ["Sanguches de Miga"]
    const rest = uniqueCategories.filter((categoria) => !prioritized.includes(categoria))
    return [...prioritized.filter((categoria) => uniqueCategories.includes(categoria)), ...rest]
  }, [])

  const filteredProducts = useMemo(() => {
    if (!selectedCategory) return []
    return productos.filter((producto) => producto.categoria === selectedCategory)
  }, [selectedCategory])

  const addToCart = (producto) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === producto.id)
      if (!existing) {
        return [...prev, { ...producto, cantidad: 1 }]
      }
      return prev.map((item) =>
        item.id === producto.id
          ? { ...item, cantidad: item.cantidad + 1 }
          : item
      )
    })

    setRecentlyAddedProductId(producto.id)
    if (addedFeedbackTimeoutRef.current) {
      clearTimeout(addedFeedbackTimeoutRef.current)
    }
    addedFeedbackTimeoutRef.current = setTimeout(() => {
      setRecentlyAddedProductId(null)
    }, 1400)

    setShowCartNotifier(true)
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current)
    }
    notificationTimeoutRef.current = setTimeout(() => {
      setShowCartNotifier(false)
    }, 3000)
  }

  const handleCategorySelect = (categoria) => {
    setSelectedCategory(categoria)
    setShowCartNotifier(false)
  }

  const removeFromCart = (id) => {
    setCart((prev) => prev.filter((item) => item.id !== id))
  }

  const updateQuantity = (id, delta) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.id === id
            ? { ...item, cantidad: Math.max(1, item.cantidad + delta) }
            : item
        )
        .filter((item) => item.cantidad > 0)
    )
  }

  const clearCart = () => {
    setCart([])
    setCustomerName("")
    setOrderNotes("")
    setDeliveryMethod("Retiro en el local")
    setDeliveryAddress("")
    setPaymentMethod("Efectivo")
    setCashAmount("")
    setRecentlyAddedProductId(null)
  }

  const total = cart.reduce(
    (sum, item) => sum + item.precio * item.cantidad,
    0
  )

  const handleScrollToCart = () => {
    if (cartRef.current) {
      cartRef.current.scrollIntoView({ behavior: "smooth", block: "start" })
      setShowCartNotifier(false)
    }
  }

  const handleSendWhatsApp = () => {
    if (cart.length === 0) return

    const name = customerName.trim()
    const notes = orderNotes.trim()
    const address = deliveryAddress.trim()
    const cashPayment = cashAmount.trim()
    const isDelivery = deliveryMethod === "Envío a domicilio"

    if (!name || (isDelivery && !address)) return

    const message = [
      "Hola! Quisiera hacer un pedido:",
      `Nombre: ${name}`,
      "",
      ...cart.map(
        (item) => `${item.cantidad} x ${item.nombre} - $${item.precio * item.cantidad}`
      ),
      "",
      `Entrega: ${deliveryMethod}`,
      ...(isDelivery ? [`Dirección: ${address}`, "Costo de envío: a confirmar"] : []),
      `Forma de pago: ${paymentMethod}`,
      ...(paymentMethod === "Efectivo" && cashPayment ? [`Abono con: $${cashPayment}`] : []),
      ...(notes ? [`Aclaraciones: ${notes}`] : []),
      "",
      `Total: $${total}`,
      "Gracias!"
    ].join("\n")

    const encodedMessage = encodeURIComponent(message)
    window.open(`https://wa.me/?text=${encodedMessage}`, "_blank")
  }

  const showShareFeedback = (message) => {
    setShareFeedback(message)
    if (shareFeedbackTimeoutRef.current) {
      clearTimeout(shareFeedbackTimeoutRef.current)
    }
    shareFeedbackTimeoutRef.current = setTimeout(() => {
      setShareFeedback("")
    }, 2500)
  }

  const handleShare = async () => {
    const shareData = {
      title: "Doña Carmen",
      text: "Mirá el menú de Doña Carmen",
      url: window.location.href,
    }

    if (navigator.share) {
      try {
        await navigator.share(shareData)
      } catch (error) {
        if (error.name !== "AbortError") {
          showShareFeedback("No se pudo compartir el enlace")
        }
      }
      return
    }

    try {
      await navigator.clipboard.writeText(shareData.url)
      showShareFeedback("Enlace copiado")
    } catch {
      showShareFeedback("No se pudo copiar el enlace")
    }
  }

  return (
    <div className="min-h-screen bg-zinc-900 p-6">
      <div className="max-w-7xl mx-auto">
        <header className="relative mb-8 pt-14 text-center sm:pt-0">
          <button
            type="button"
            onClick={handleShare}
            aria-label="Compartir este menú"
            className="absolute right-0 top-0 inline-flex h-11 w-11 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800 text-zinc-100 shadow-lg transition duration-150 hover:border-orange-500 hover:bg-zinc-700 active:scale-90 active:bg-orange-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <path d="m8.7 10.7 6.6-4.1M8.7 13.3l6.6 4.1" />
            </svg>
          </button>
          <div className="inline-flex flex-col items-center gap-3">
            <h1 className="text-4xl font-bold text-white">
              Doña Carmen
            </h1>
            <p className="text-zinc-300 max-w-xl">
              Pedidos rápidos y caseros para disfrutar lo mejor de la cocina de Doña Carmen, directo a tu mesa con WhatsApp.
            </p>
          </div>
          {shareFeedback && (
            <p
              role="status"
              className="fixed right-6 top-20 z-50 rounded-full bg-zinc-800 px-3 py-2 text-xs font-medium text-white shadow-lg"
            >
              {shareFeedback}
            </p>
          )}
        </header>

        <div className="mb-8">
          {!selectedCategory ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {categorias.map((categoria) => {
                const categoryProduct = productos.find(
                  (producto) => producto.categoria === categoria
                )
                return (
                  <button
                    key={categoria}
                    type="button"
                    onClick={() => handleCategorySelect(categoria)}
                    className="group relative overflow-hidden rounded-[2rem] border border-zinc-700 bg-zinc-800 text-left shadow-lg transition duration-150 hover:-translate-y-1 hover:border-orange-500 active:translate-y-0 active:scale-[0.97] active:border-orange-500"
                  >
                    <img
                      src={categoryProduct?.imagen}
                      alt={categoria}
                      className="h-40 w-full object-cover transition duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/90 via-transparent to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-5">
                      <span className="text-xs uppercase tracking-[0.4em] text-orange-400">
                        Categoría
                      </span>
                      <h2 className="mt-2 text-xl font-bold text-white">
                        {categoria}
                      </h2>
                    </div>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="mb-8 flex flex-col gap-4 items-center text-center">
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedCategory(null)}
                  className="rounded-full border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-200 transition duration-150 hover:bg-zinc-700 active:scale-95 active:bg-zinc-700"
                >
                  ← Volver a categorías
                </button>
                <h2 className="text-3xl font-bold text-white">{selectedCategory}</h2>
              </div>
              <p className="max-w-2xl text-zinc-400">
                Navegá la sección de {selectedCategory} y elegí lo que quieras sumar al carrito.
              </p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_0.9fr] gap-6">
          <div>
            {selectedCategory ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredProducts.map((producto) => (
                  <ProductCard
                    key={producto.id}
                    producto={producto}
                    onAdd={() => addToCart(producto)}
                    wasJustAdded={recentlyAddedProductId === producto.id}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-zinc-700 bg-zinc-900/80 p-12 text-center text-zinc-400">
                Seleccioná una categoría para ver sus productos.
              </div>
            )}
          </div>

          <div ref={cartRef}>
            <Cart
              cartItems={cart}
              onRemove={removeFromCart}
              onUpdateQuantity={updateQuantity}
              onClear={clearCart}
              total={total}
              customerName={customerName}
              onCustomerNameChange={setCustomerName}
              orderNotes={orderNotes}
              onOrderNotesChange={setOrderNotes}
              deliveryMethod={deliveryMethod}
              onDeliveryMethodChange={setDeliveryMethod}
              deliveryAddress={deliveryAddress}
              onDeliveryAddressChange={setDeliveryAddress}
              paymentMethod={paymentMethod}
              onPaymentMethodChange={setPaymentMethod}
              cashAmount={cashAmount}
              onCashAmountChange={setCashAmount}
              onSendWhatsApp={handleSendWhatsApp}
            />
          </div>
        </div>
        {showCartNotifier && (
          <button
            type="button"
            onClick={handleScrollToCart}
            className="fixed bottom-6 right-6 z-50 inline-flex items-center gap-3 rounded-full bg-orange-500 px-4 py-3 text-sm font-semibold text-white shadow-2xl transition duration-150 hover:bg-orange-600 active:scale-95 active:bg-orange-600"
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-lg">
              🛒
            </span>
            <span className="whitespace-nowrap">Agregado al carrito. Ver resumen ↓</span>
          </button>
        )}
      </div>
    </div>
  )
}

export default App
