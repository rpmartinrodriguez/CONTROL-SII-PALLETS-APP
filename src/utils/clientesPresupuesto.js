// Matching comercial usado tanto en el historial como en el buscador de clientes.
export const normalizarBusqueda = texto => String(texto || '').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-AR').replace(/\s+/g, ' ').trim();

export const coincideCliente = (cliente, filtro) => {
  const q = normalizarBusqueda(filtro);
  if (!q) return false;
  return [cliente.razonSocial, cliente.cuit, cliente.telefono].some(v => normalizarBusqueda(v).includes(q));
};

export function ultimoPrecioCliente(historial, clienteId, producto, clienteNombre = '') {
  if (!producto || !(producto.codigo || producto.descripcion) || !(clienteId || clienteNombre)) return null;
  const codigo = normalizarBusqueda(producto.codigo);
  const descripcion = normalizarBusqueda(producto.descripcion);
  const nombre = normalizarBusqueda(clienteNombre);
  const candidatos = [];
  for (const presupuesto of historial || []) {
    const mismoCliente = clienteId
      ? presupuesto.clienteId === clienteId
      : normalizarBusqueda(presupuesto.cliente?.razonSocial) === nombre;
    if (!mismoCliente) continue;
    for (const item of presupuesto.items || []) {
      const codigoItem = normalizarBusqueda(item.codigo);
      const descripcionItem = normalizarBusqueda(item.descripcion);
      // Código identificado primero; cuando falta se usa la descripción exacta.
      const coincide = codigo && codigoItem ? codigo === codigoItem : descripcion && descripcionItem && descripcion === descripcionItem;
      if (!coincide) continue;
      const precio = Number(item.precioUnitario);
      if (!Number.isFinite(precio)) continue;
      candidatos.push({
        precioUnitario: precio,
        numero: presupuesto.numero,
        fecha: presupuesto.fecha,
        descripcion: item.descripcion,
        codigo: item.codigo,
        fechaGuardado: presupuesto.guardadoEn?.seconds || 0,
        id: presupuesto.id
      });
    }
  }
  candidatos.sort((a, b) =>
    String(b.fecha || '').localeCompare(String(a.fecha || '')) ||
    b.fechaGuardado - a.fechaGuardado ||
    String(b.numero || '').localeCompare(String(a.numero || ''))
  );
  return candidatos[0] || null;
}
