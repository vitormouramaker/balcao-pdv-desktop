export interface SaleProduct {
  id: number;
  name: string;
  price: number;
  sku: string; // O sku é o nosso código de barras
  type: "UNIDADE" | "PESO";
  inicio_promocao?: string;
  fim_promocao?: string;
}

export const productCatalog: SaleProduct[] = [
  {
    id: 1,
    name: "Água Mineral 500ml",
    price: 2.5,
    sku: "7890001001011",
    type: "UNIDADE",
  },
  {
    id: 2,
    name: "Refrigerante Lata 350ml",
    price: 4.5,
    sku: "7890002002022",
    type: "UNIDADE",
  },
  {
    id: 3,
    name: "Chocolate Barra 90g",
    price: 6.0,
    sku: "7890003003033",
    type: "UNIDADE",
  },
  { id: 4, name: "Pão Francês", price: 18.9, sku: "2001", type: "PESO" }, // Preço por KG
  {
    id: 5,
    name: "Queijo Muçarela Fatiado",
    price: 59.9,
    sku: "2002",
    type: "PESO",
  }, // Preço por KG
];
