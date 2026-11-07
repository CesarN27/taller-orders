import { invokeLambda, productFn } from './lambda-invoke';

// Ids de los productos que vende un vendedor, consultando la lambda de Products.
// Si la consulta falla, regresa un conjunto vacío (nadie será considerado vendedor de la orden).
export async function getSellerProductIds(sellerId: string): Promise<Set<string>> {
  const ids = new Set<string>();
  try {
    const res = await invokeLambda<{ products: { productId: string }[] }>(
      productFn('listProductsBySeller'),
      { pathParameters: { sellerId } }
    );
    if (res.statusCode === 200) {
      res.body.products.forEach((p) => ids.add(p.productId));
    }
  } catch (error) {
    console.error('Error al consultar los productos del vendedor', error);
  }
  return ids;
}
