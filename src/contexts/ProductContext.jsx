import React, { createContext, useState, useEffect, useContext } from 'react';
import { BOMCalculator } from '../utils/BOMCalculator';

const ProductContext = createContext();
const bomCalculator = new BOMCalculator();

export const ProductProvider = ({ children }) => {
  const [productsData, setProductsData] = useState(null);
  const [loading, setLoading] = useState(true);

  const [selections, setSelections] = useState({
    type: '',
    version: '',
    color: '',
    size: '',
    height: '',
    level: '',
    quantity: 1,
  });

  const [price, setPrice] = useState(0);
  const [bom, setBom] = useState([]);

  const [availableOptions, setAvailableOptions] = useState({
    versions: [], sizes: [], heights: [], levels: [], colors: []
  });

  useEffect(() => {
    fetch('/sammirack-estimator/data.json')
      .then(res => res.json())
      .then(data => {
        setProductsData(data);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!productsData) return;

    const { type, version, color, size, height, level, quantity } = selections;
    const product = productsData[type];

    const newOptions = { versions: [], sizes: [], heights: [], levels: [], colors: [] };
    if (product) {
      if (product.버전) newOptions.versions = Object.keys(product.버전);
      if (product.색상) newOptions.colors = product.색상;
      
      const priceData = product.기본가격;
      if (priceData) {
        const sizeSource = type === '하이랙' ? priceData[color] : priceData;
        if (sizeSource) {
          newOptions.sizes = Object.keys(sizeSource);
          if (size && sizeSource[size]) {
            newOptions.heights = Object.keys(sizeSource[size]);
            if (height && sizeSource[size][height]) {
              newOptions.levels = Object.keys(sizeSource[size][height]);
            }
          }
        }
      }
    }
    setAvailableOptions(newOptions);

    let unitPrice = 0;
    try {
      if (type === '스텐랙' && version && size && height && level) {
        // 스텐랙은 버전별 기본가 + 옵션별 가격으로 재계산해야 할 수 있으나, 우선 버전가격을 기본으로 설정
        unitPrice = product.버전[version].기본가;
      } else if (type === '하이랙' && color && size && height && level) {
        unitPrice = product.기본가격[color][size][height][level];
      }
    } catch (e) {
      unitPrice = 0;
    }
    setPrice(unitPrice * (quantity || 1));

    const newBom = bomCalculator.calculateBOM(type, selections);
    setBom(newBom);

  }, [productsData, selections]);

  const value = {
    loading,
    productsData,
    selections,
    setSelections,
    availableOptions,
    price,
    bom,
  };

  return <ProductContext.Provider value={value}>{children}</ProductContext.Provider>;
};

export const useProducts = () => useContext(ProductContext);
