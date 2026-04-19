import { ElementType, type PrintElement } from '../types';

const defaultTableScript = `// RMB Uppercase Conversion
try {
  function digitUppercase(n) {
      var fraction = ['角', '分'];
      var digit = [
          '零', '壹', '贰', '叁', '肆',
          '伍', '陆', '柒', '捌', '玖'
      ];
      var unit = [
          ['元', '万', '亿'],
          ['', '拾', '佰', '仟']
      ];
      var head = n < 0 ? '欠' : '';
      n = Math.abs(n);
      var s = '';
      for (var i = 0; i < fraction.length; i++) {
          s += (digit[Math.floor(n * 10 * Math.pow(10, i)) % 10] + fraction[i]).replace(/零./, '');
      }
      s = s || '整';
      n = Math.floor(n);
      for (var i = 0; i < unit[0].length && n > 0; i++) {
          var p = '';
          for (var j = 0; j < unit[1].length && n > 0; j++) {
              p = digit[n % 10] + unit[1][j] + p;
              n = Math.floor(n / 10);
          }
          s = p.replace(/(零.)*零$/, '').replace(/^$/, '零') + unit[0][i] + s;
      }
      return head + s.replace(/(零.)*零元/, '元')
          .replace(/(零.)+/g, '零')
          .replace(/^整$/, '零元整');
  }

  // 1. Calculate Total (works for both Global and Page data)
  let totalAmount = 0;
  let totalQty = 0;
  if (data && Array.isArray(data)) {
    data.forEach(row => {
      // Ensure numeric values
      const val = Number(row.total) || 0;
      const qty = Number(row.qty) || 0;
      totalAmount += val;
      totalQty += qty;
    });
  }

  // 2. Update Footer Data
  if (footerData && Array.isArray(footerData)) {
    footerData.forEach(row => {
      Object.keys(row).forEach(key => {
        const val = row[key];
        const processValue = (v) => {
          if (typeof v !== 'string') return v;
          
          // Global replacements (Grand Total)
          if (typeof type === 'undefined' || type !== 'page') {
              if (v.includes('{#totalSum}')) return v.replace('{#totalSum}', totalAmount.toFixed(2));
              if (v.includes('{#totalQty}')) return v.replace('{#totalQty}', String(totalQty));
              if (v.includes('{#totalCap}')) return v.replace('{#totalCap}', digitUppercase(totalAmount));
              
              // For {#pageSum}, we want to show the Grand Total in the Designer (visual feedback),
              // but pass the original {#pageSum} token to the Print logic (via data-value).
              if (v.includes('{#pageSum}')) {
                  const displayVal = v.replace('{#pageSum}', totalAmount.toFixed(2));
                  // printValue keeps {#pageSum} but resolves other globals
                  const printVal = v.replace('{#totalSum}', totalAmount.toFixed(2))
                                  .replace('{#totalQty}', String(totalQty))
                                  .replace('{#totalCap}', digitUppercase(totalAmount)); 
                  
                  return { value: displayVal, printValue: printVal };
              }

              // For {#pageQty}
              if (v.includes('{#pageQty}')) {
                  const displayVal = v.replace('{#pageQty}', String(totalQty));
                  // printValue keeps {#pageQty} but resolves other globals
                  const printVal = v.replace('{#totalSum}', totalAmount.toFixed(2))
                                  .replace('{#totalQty}', String(totalQty))
                                  .replace('{#totalCap}', digitUppercase(totalAmount)); 
                  
                  return { value: displayVal, printValue: printVal };
              }
          }
          
          // Page replacements (Page Sum)
          if (typeof type !== 'undefined' && type === 'page') {
              if (v.includes('{#pageSum}')) return v.replace('{#pageSum}', totalAmount.toFixed(2));
              if (v.includes('{#pageQty}')) return v.replace('{#pageQty}', String(totalQty));
          }
          return v;
        };

        // Handle object values
        if (val && typeof val === 'object') {
          // If it has a 'field' property, check if it contains a variable
          if (val.field && typeof val.field === 'string') {
              const processed = processValue(val.field);
              // If processed is different from field (meaning a replacement happened)
              // OR if processValue returned an object (for {#pageSum})
              if (processed !== val.field || typeof processed === 'object') {
                  if (typeof processed === 'object') {
                      val.result = processed.value; // Store in result, keep val.value as text
                      val.printValue = processed.printValue;
                  } else {
                      val.result = processed;
                  }
              }
          }
          // Also check 'value' if it was set manually and looks like a variable
          else if (val.value && typeof val.value === 'string') {
              // Only process if value looks like a variable, otherwise it's just text
              if (val.value.includes('{#')) {
                  const processed = processValue(val.value);
                  if (typeof processed === 'object') {
                      val.result = processed.value;
                      val.printValue = processed.printValue;
                  } else {
                      val.result = processed;
                  }
              }
          }
        }
      });
    });
  }

  return { data, footerData };
} catch (e) {
  console.error('Script Execution Error:', e);
  return { data, footerData };
}`;

// 使用注册表模式管理各元素的默认配置
type ElementConfigGenerator = (t: (key: string) => string) => Partial<PrintElement>;

export const elementConfigRegistry: Partial<Record<ElementType, ElementConfigGenerator>> = {
  [ElementType.TEXT]: (t) => ({
    content: t('canvas.newText'),
    style: { backgroundColor: 'transparent', borderColor: 'transparent' }
  }),

  [ElementType.IMAGE]: () => ({
    style: { backgroundColor: 'transparent', borderColor: 'transparent' }
  }),

  [ElementType.BARCODE]: () => ({
    height: 80,
    content: '12345678',
    style: { backgroundColor: 'transparent', borderColor: 'transparent' }
  }),

  [ElementType.QRCODE]: () => ({
    width: 100,
    content: 'https://example.com',
    style: { backgroundColor: 'transparent', borderColor: 'transparent' }
  }),

  [ElementType.LINE]: () => ({
    height: 20,
    style: { borderColor: '#000000' }
  }),

  [ElementType.RECT]: () => ({
    width: 100,
    style: { backgroundColor: 'transparent', borderColor: '#000000' }
  }),

  [ElementType.CIRCLE]: () => ({
    width: 100,
    style: { backgroundColor: 'transparent', borderColor: '#000000' }
  }),

  [ElementType.PAGE_NUMBER]: () => ({
    width: 52,
    height: 20,
    format: '1/Total',
    labelColor: '#000000',
    labelBackgroundColor: 'transparent',
    labelBorderColor: 'transparent',
    style: { backgroundColor: 'transparent', borderColor: '#000000' }
  }),

  [ElementType.TABLE]: (t) => ({
    height: 150,
    columnsVariable: '',
    footerDataVariable: '',
    columns: [
      { field: 'id', header: t('canvas.defaultTableHeaders.id'), width: 50 },
      { field: 'name', header: t('canvas.defaultTableHeaders.name'), width: 100 },
      { field: 'qty', header: t('canvas.defaultTableHeaders.qty'), width: 60 },
      { field: 'price', header: t('canvas.defaultTableHeaders.price'), width: 80 },
      { field: 'total', header: t('canvas.defaultTableHeaders.total'), width: 80 },
    ],
    data: Array.from({ length: 30 }, (_, i) => ({
      id: i + 1,
      name: `${t('canvas.defaultTableData.item')} ${i + 1}`,
      qty: (i % 5) + 1,
      price: 100 + (i * 10),
      total: ((i % 5) + 1) * (100 + (i * 10))
    })),
    showFooter: true,
    tfootRepeat: true,
    autoPaginate: true,
    repeatPerPage: false,
    footerData: [
      { id: { value: t('canvas.defaultTableData.pageSum') }, qty: { value: '', field: '{#pageQty}' }, total: { value: '', field: '{#pageSum}' } },
      { id: { value: t('canvas.defaultTableData.total') }, qty: { value: '', field: '{#totalQty}' }, total: { value: '', field: '{#totalSum}' } },
      { id: { value: t('canvas.defaultTableData.inWords') }, total: { value: '', field: '{#totalCap}' } }
    ],
    customScript: defaultTableScript,
    style: {
      backgroundColor: 'transparent',
      borderColor: '#000000',
      headerBackgroundColor: '#f3f4f6',
      headerColor: '#000000',
      footerBackgroundColor: '#f9fafb',
      footerColor: '#000000',
      textAlign: 'left',
      headerTextAlign: 'left',
      footerTextAlign: 'left'
    }
  })
};

export function createNewElement(
  type: ElementType,
  x: number,
  y: number,
  t: (key: string) => string
): Omit<PrintElement, 'id'> {
  // 1. 提取所有元素的通用基础属性兜底
  const baseElement: Omit<PrintElement, 'id'> = {
    type,
    x,
    y,
    width: 200,
    height: 100,
    variable: '',
    style: {
      fontSize: 14,
      color: '#000000',
    }
  };

  // 2. 从注册表中获取特定元素的专属配置
  const generateSpecificConfig = elementConfigRegistry[type];
  const specificConfig = generateSpecificConfig ? generateSpecificConfig(t) : {};

  // 3. 深度合并特定配置与基础配置（注意 style 对象的合并）
  return {
    ...baseElement,
    ...specificConfig,
    style: {
      ...baseElement.style,
      ...(specificConfig.style || {})
    }
  };
}
