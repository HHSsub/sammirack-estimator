import React, { createContext, useContext, useState } from 'react';

const ProductContext = createContext();

export const ProductProvider = ({ children }) => {
  // Product selection state
  const [productType, setProductType] = useState('');
  const [selectedOptions, setSelectedOptions] = useState({});
  const [price, setPrice] = useState(0);
  
  // Current form data
  const [currentEstimate, setCurrentEstimate] = useState(null);
  const [currentOrder, setCurrentOrder] = useState(null);
  
  return (
    <ProductContext.Provider value={{
      productType,
      setProductType,
      selectedOptions,
      setSelectedOptions,
      price,
      setPrice,
      currentEstimate,
      setCurrentEstimate,
      currentOrder,
      setCurrentOrder
    }}>
      {children}
    </ProductContext.Provider>
  );
};

export const useProductState = () => useContext(ProductContext);