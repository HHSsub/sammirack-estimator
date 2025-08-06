import React, { createContext, useState, useEffect, useContext } from "react";
import { BOMCalculator } from "../utils/BOMCalculator";
import { applyRateToPrice } from "../utils/priceUtils";

const ProductContext = createContext();
const bomCalculator = new BOMCalculator();

const EXTRA_OPTIONS = {
  스텐랙: { sizes: ["50x210"], heights: ["210"], levels: ["2단", "3단", "4단", "5단", "6단"] },
  하이랙: { sizes: ["45x150", "80x108"], heights: ["250"], levels: ["2단", "3단", "4단", "5단", "6단"] },
  경량랙: { formTypes: ["독립형", "연결형"] },
  중량랙: { formTypes: ["독립형", "연결형"] },
  파렛트랙: { formTypes: ["독립형", "연결형"] },
};

export const ProductProvider = ({ children }) => {
  const [productsData, setProductsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState([]);

  const [selections, setSelectionsRaw] = useState({
    type: "",
    version: "",
    color: "",
    formType: "", // ← 신설됨
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
    if (!productsData) return { versions: [], colors: [], formTypes: [], sizes: [], heights: [], levels: [] };

    const { type, color, size, height, formType } = selections;
    const product = productsData[type];
    const opts = { versions: [], colors: [], formTypes: [], sizes: [], heights: [], levels: [] };

    if (type === "스텐랙" && product?.기본가격) {
      opts.sizes = Object.keys(product.기본가격);
      if (size && product.기본가격[size]) {
        opts.heights = Object.keys(product.기본가격[size]);
        if (height && product.기본가격[size][height]) {
          opts.levels = Object.keys(product.기본가격[size][height]);
        }
      }
      opts.versions = product.버전 ? Object.keys(product.버전) : [];
    }

    if (type === "하이랙" && product) {
      opts.colors = product.색상 || [];
      if (color && product.기본가격?.[color]) {
        opts.sizes = Object.keys(product.기본가격[color]);
        if (size && product.기본가격[color][size]) {
          opts.heights = Object.keys(product.기본가격[color][size]);
          if (height && product.기본가격[color][size][height]) {
            opts.levels = Object.keys(product.기본가격[color][size][height]);
          }
        }
      }
    }

    if (["경량랙", "중량랙", "파렛트랙"].includes(type)) {
      opts.formTypes = Object.keys(product);
      if (formType && product[formType]) {
        opts.sizes = Object.keys(product[formType]);
        if (size && product[formType][size]) {
          opts.heights = Object.keys(product[formType][size]);
          if (height && product[formType][size][height]) {
            opts.levels = Object.keys(product[formType][size][height]);
          }
        }
      }
    }

    return opts;
  };

  const baseOptions = getOptionsFromJson();
  const extraOptions = { versions: [], colors: [], formTypes: [], sizes: [], heights: [], levels: [] };

  if (selections.type && EXTRA_OPTIONS[selections.type]) {
    Object.assign(extraOptions, EXTRA_OPTIONS[selections.type]);
  }

  const uniq = (arr) => [...new Set(arr.filter(Boolean))];
  const mergeOptions = (a, b) => {
    return {
      versions: uniq([...a.versions, ...b.versions]),
      colors: uniq([...a.colors, ...b.colors]),
      formTypes: uniq([...a.formTypes, ...b.formTypes]),
      sizes: uniq([...a.sizes, ...b.sizes]),
      heights: uniq([...a.heights, ...b.heights]),
      levels: uniq([...a.levels, ...b.levels]),
    };
  };

  const availableOptions = mergeOptions(baseOptions, extraOptions);

  const isOptionInJson = () => {
    try {
      const { type, version, color, size, height, level, formType } = selections;
      const p = productsData[type];
      if (!p) return false;

      if (type === "스텐랙") return !!(version && p.버전?.[version] && p.기본가격?.[size]?.[height]?.[level] !== undefined);
      if (type === "하이랙") return !!(color && p.기본가격?.[color]?.[size]?.[height]?.[level] !== undefined);
      if (["경량랙", "중량랙", "파렛트랙"].includes(type)) {
        return !!(formType && p[formType]?.[size]?.[height]?.[level] !== undefined);
      }
    } catch {
      return false;
    }
    return false;
  };

  useEffect(() => {
    if (!productsData) return;
    const { type, version, color, size, height, level, quantity, applyRate, customPrice, formType } = selections;
    const p = productsData[type];
    let unitPrice = 0;

    if (customPrice !== null) unitPrice = Number(customPrice);
    else {
      try {
        if (type === "스텐랙") unitPrice = p.기본가격[size][height][level] + (p.버전[version]?.기본가 || 0);
        else if (type === "하이랙") unitPrice = p.기본가격[color][size][height][level];
        else if (["경량랙", "중량랙", "파렛트랙"].includes(type)) unitPrice = p[formType][size][height][level];
      } catch {
        unitPrice = 0;
      }
    }

    const adjusted = applyRateToPrice(unitPrice, applyRate || 100);
    setCurrentPrice(adjusted * (quantity || 1));
    setCurrentBom(bomCalculator.calculateBOM(type, selections, quantity || 1));
  }, [productsData, selections]);

  const addToCart = () => {
    if (currentPrice <= 0) return alert("가격 계산 불가 항목입니다.");

    const { type, version, color, size, height, level, quantity, applyRate, customPrice, formType } = selections;
    const p = productsData[type];
    let originalUnitPrice = 0;

    try {
      if (customPrice !== null) originalUnitPrice = Number(customPrice);
      else {
        if (type === "스텐랙") originalUnitPrice = p.기본가격[size][height][level] + (p.버전[version]?.기본가 || 0);
        else if (type === "하이랙") originalUnitPrice = p.기본가격[color][size][height][level];
        else if (["경량랙", "중량랙", "파렛트랙"].includes(type)) originalUnitPrice = p[formType][size][height][level];
      }
    } catch {
      originalUnitPrice = 0;
    }

    const displayName = (() => {
      if (type === "스텐랙") return `스텐랙 - ${size}x${height} / ${level} / ${version}`;
      if (type === "하이랙") return `하이랙 (${color}) - ${size} / ${height} / ${level}단`;
      if (["경량랙", "중량랙", "파렛트랙"].includes(type)) return `${type} (${formType}) - ${size} / ${height} / ${level}`;
      return type;
    })();

    const newItem = {
      id: Date.now(),
      selections,
      displayName,
      price: currentPrice,
      originalPrice: originalUnitPrice * (quantity || 1),
      unitPrice: applyRateToPrice(originalUnitPrice, applyRate || 100),
      originalUnitPrice,
      applyRate: applyRate || 100,
      bom: currentBom,
    };

    setCart((prev) => [...prev, newItem]);
  };

  const removeFromCart = (id) => setCart((prev) => prev.filter((item) => item.id !== id));
  const clearCart = () => setCart([]);
  const cartTotal = cart.reduce((acc, item) => acc + item.price, 0);

  const isCustomPriceMode =
    !isOptionInJson() && selections.type !== "" &&
    ((selections.type === "스텐랙" && selections.version === "기본형 V1") ||
     selections.type === "하이랙" || ["경량랙", "중량랙", "파렛트랙"].includes(selections.type)) &&
    selections.size && selections.height && selections.level;

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
        addToCart,
        removeFromCart,
        clearCart,
        cartTotal,
        isCustomPriceMode,
        isOptionFullyOpen: false,
        isExtraOptionSelected: false,
      }}
    >
      {children}
    </ProductContext.Provider>
  );
};

export const useProducts = () => useContext(ProductContext);
