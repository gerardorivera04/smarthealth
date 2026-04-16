// Small shared UI primitives used across the entity tabs.

export function Card({ title, action, children }) {
  return (
    <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
      {(title || action) && (
        <div className="flex items-center justify-between mb-4">
          {title && <h2 className="text-lg font-semibold text-gray-900">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Button({ children, variant = "primary", ...props }) {
  const styles = {
    primary: "bg-teal-600 text-white hover:bg-teal-700",
    ghost: "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50",
    danger: "bg-red-600 text-white hover:bg-red-700",
  };
  return (
    <button
      {...props}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${styles[variant]} ${props.className || ""}`}
    >
      {children}
    </button>
  );
}

export function Input({ label, ...props }) {
  return (
    <label className="block">
      {label && <span className="block text-sm font-medium text-gray-700 mb-1">{label}</span>}
      <input
        {...props}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
      />
    </label>
  );
}

export function Select({ label, children, ...props }) {
  return (
    <label className="block">
      {label && <span className="block text-sm font-medium text-gray-700 mb-1">{label}</span>}
      <select
        {...props}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
      >
        {children}
      </select>
    </label>
  );
}

export function Textarea({ label, ...props }) {
  return (
    <label className="block">
      {label && <span className="block text-sm font-medium text-gray-700 mb-1">{label}</span>}
      <textarea
        {...props}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
      />
    </label>
  );
}

export function ErrorBanner({ message }) {
  if (!message) return null;
  return (
    <div className="bg-red-50 text-red-700 px-4 py-2 rounded-lg text-sm mb-3">{message}</div>
  );
}

export function EmptyState({ children }) {
  return <p className="text-sm text-gray-400 italic">{children}</p>;
}
