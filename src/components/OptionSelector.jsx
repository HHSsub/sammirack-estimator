import React, { createContext, useState, useEffect, useContext } from "react";
import { BOMCalculator } from "../utils/BOMCalculator";
import { applyRateToPrice } from "../utils/priceUtils";

const ProductContext = createContext();
const bomCalculator = new BOMCalculator();

const EXTRA_OPTIONS = {
  스텐랙: { sizes: ["50x210"], heights: ["210"], levels: ["2단", "3단", "4단", "5단", "6단"] },
  하이랙: { sizes: ["45x150", "80x108"], heights: ["250"], levels: ["2단", "3단", "4단", "5단", "6단"] },
  파렛트랙: { formats: [], sizes: [], heights: [], levels: [] },
  경량랙: { formats: [], sizes: [], heights: [], levels: [] },
  중량랙: { formats: [], sizes: [], heights: [], levels: [] },
};

export const ProductProvider = ({ children }) => {
  const [productsData, setProductsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState([]);

  const [selections, setSelectionsRaw] = useState({
    type: "",
    version: "",
    color: "",
    format: "",
    size: "",
    height: "",
    level: "",
    quantity: 1,
    applyRate: 100,
    customPrice: null,
  });

  const setSelections = (updater) => {
    setSelectionsRaw((prev) => {
      const updated = typeof updater === "function" ? updater(prev) : updater;
      if (updated.type === "스텐랙") return { ...updated, version: "기본형 V1" };
      return { ...updated, version: "" };
    });
  };

  const [currentPrice, setCurrentPrice] = useState(0);
  const [currentBom, setCurrentBom] = useState([]);

  useEffect(() => {
    fetch("/sammirack-estimator/data.json")
      .then((res) => res.json())
      .then((data) => {
        setProductsData(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const getOptionsFromJson = () => {
    if (!productsData) {
      return {
        versions: [], colors: [], formats: [], sizes: [], heights: [], levels: [],
      };
    }

    const { type, color, version, format, size, height } = selections;
    const product = productsData[type];
    let opts = { versions: [], colors: [], formats: [], sizes: [], heights: [], levels: [] };

    if (type === "스텐랙") {
      opts.sizes = Object.keys(product?.기본가격 || {});
      if (size) {
        opts.heights = Object.keys(product.기본가격[size] || {});
        if (height) opts.levels = Object.keys(product.기본가격[size][height] || {});
      }
      opts.versions = Object.keys(product?.버전 || {});
    }

    if (type === "하이랙") {
      opts.colors = product?.색상 || [];
      if (color && product.기본가격[color]) {
        opts.sizes = Object.keys(product.기본가격[color] || {});
        if (size) {
          opts.heights = Object.keys(product.기본가격[color][size] || {});
          if (height) opts.levels = Object.keys(product.기본가격[color][size][height] || {});
        }
      }
    }

    if (["경량랙", "중량랙", "파렛트랙"].includes(type)) {
      opts.formats = Object.keys(product?.기본가격 || {});
      if (format) {
        opts.sizes = Object.keys(product.기본가격[format] || {});
        if (size) {
          opts.heights = Object.keys(product.기본가격[format][size] || {});
          if (height) opts.levels = Object.keys(product.기본가격[format][size][height] || {});
        }
      }
    }

    return opts;
  };

  const mergeOptions = (baseOpts, extraOpts) => {
    const uniq = (arr) => [...new Set(arr.filter(Boolean))];
    return {
      versions: uniq([...(baseOpts.versions || []), ...(extraOpts.versions || [])]),
      colors: uniq([...(baseOpts.colors || []), ...(extraOpts.colors || [])]),
      formats: uniq([...(baseOpts.formats || []), ...(extraOpts.formats || [])]),
      sizes: uniq([...(baseOpts.sizes || []), ...(extraOpts.sizes || [])]),
      heights: uniq([...(baseOpts.heights || []), ...(extraOpts.heights || [])]),
      levels: uniq([...(baseOpts.levels || []), ...(extraOpts.levels || [])]),
    };
  };

  const baseOptions = getOptionsFromJson();
  const extraOptions = EXTRA_OPTIONS[selections.type] || { versions: [], colors: [], formats: [], sizes: [], heights: [], levels: [] };
  const availableOptions = mergeOptions(baseOptions, extraOptions);

  const isExtraOptionSelected = () => {
    if (!selections.type) return false;
    const extra = EXTRA_OPTIONS[selections.type];
    if (!extra) return false;
    return (
      extra.sizes.includes(selections.size) ||
      extra.heights.includes(selections.height) ||
      extra.levels.includes(selections.level)
    );
  };

  const isOptionFullyOpen = isExtraOptionSelected();

  const isOptionInJson = () => {
    if (!productsData) return false;
    try {
      const { type, version, color, format, size, height, level } = selections;
      const product = productsData[type];
      if (!product) return false;

      if (type === "스텐랙") {
        return !!(version && product?.버전?.[version] && product?.기본가격?.[size]?.[height]?.[level] !== undefined);
      }
      if (type === "하이랙") {
        return !!(color && product?.기본가격?.[color]?.[size]?.[height]?.[level] !== undefined);
      }
      if (["경량랙", "중량랙", "파렛트랙"].includes(type)) {
        return !!(format && product?.기본가격?.[format]?.[size]?.[height]?.[level] !== undefined);
      }
    } catch {
      return false;
    }
    return false;
  };

  return (
    <ProductContext.Provider
      value={{
        loading,
        productsData,
        selections,
        setSelections,
        availableOptions,
        currentPrice,
        currentBom,
        cart,
        addToCart: () => {},
        removeFromCart: (id) => setCart((prev) => prev.filter((item) => item.id !== id)),
        clearCart: () => setCart([]),
        cartTotal: cart.reduce((acc, item) => acc + item.price, 0),
        isCustomPriceMode: !isOptionInJson() && selections.type && selections.size && selections.height && selections.level,
        isOptionFullyOpen,
        isExtraOptionSelected: isExtraOptionSelected(),
      }}
    >
      {children}
    </ProductContext.Provider>
  );
};

export const useProducts = () => useContext(ProductContext);
