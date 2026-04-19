# Building a New Custom Element

This guide describes how to add a new custom element to Vue Print Designer. We will use a simple "Star" element as an example.

## Step 1: Define Element Type

First, add a new type definition to the `ElementType` enum in `src/types/index.ts`.

```typescript
// src/types/index.ts

export enum ElementType {
  // ... existing types
  TEXT = 'text',
  // ...
  STAR = 'star' // [!code ++]
}
```

## Step 2: Create Element Component

Create a new Vue component in the `src/components/elements/` directory, e.g., `StarElement.vue`. This component is responsible for rendering the element's content and exporting the property configuration Schema.

```vue
<!-- src/components/elements/StarElement.vue -->
<script setup lang="ts">
import type { PrintElement } from '@/types';

defineProps<{
  element: PrintElement;
}>();
</script>

<script lang="ts">
import type { ElementPropertiesSchema } from '@/types';

// Define property panel configuration
export const elementPropertiesSchema: ElementPropertiesSchema = {
  sections: [
    {
      title: 'properties.section.style',
      tab: 'style',
      fields: [
        { 
          label: 'properties.label.color', 
          type: 'color', 
          target: 'style', 
          key: 'color' 
        }
      ]
    }
  ]
};
</script>

<template>
  <div class="w-full h-full flex items-center justify-center">
    <svg viewBox="0 0 24 24" :fill="element.style.color || '#000000'">
      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
    </svg>
  </div>
</template>
```

## Step 3: Register Component

Import the new component in `src/components/canvas/Canvas.vue` and add the mapping in the `getComponent` function.

```typescript
// src/components/canvas/Canvas.vue

import StarElement from '../elements/StarElement.vue'; // [!code ++]

// ...

const getComponent = (type: ElementType) => {
  switch (type) {
    // ...
    case ElementType.STAR: return StarElement; // [!code ++]
    default: return TextElement;
  }
};
```

## Step 4: Register Properties Configuration

Import the component's Schema in `src/components/layout/PropertiesPanel.vue` and add the mapping in the `getSchema` function.

```typescript
// src/components/layout/PropertiesPanel.vue

import { elementPropertiesSchema as StarSchema } from '@/components/elements/StarElement.vue'; // [!code ++]

// ...

const getSchema = (type: ElementType): ElementPropertiesSchema | null => {
  switch (type) {
    // ...
    case ElementType.STAR: return StarSchema; // [!code ++]
  }
  return null;
};
```

## Step 5: Add to Sidebar

Configure the sidebar menu item in `src/components/layout/Sidebar.vue` so that it can be dragged.

```typescript
// src/components/layout/Sidebar.vue
import StarIcon from '~icons/material-symbols/star'; // Import icon

// ...

const categories = [
  // ...
  {
    title: 'sidebar.shapes',
    items: [
      // ...
      { type: ElementType.STAR, label: 'sidebar.star', icon: StarIcon }, // [!code ++]
    ]
  }
];

// ...

const getIcon = (type: ElementType) => {
  switch (type) {
    // ...
    case ElementType.STAR: return StarIcon; // [!code ++]
    // ...
  }
};
```

## Step 6: Configure Default Properties

In `src/utils/elementFactory.ts`, add the new element's default dimensions and properties to the `elementConfigRegistry`.

```typescript
// src/utils/elementFactory.ts

export const elementConfigRegistry: Partial<Record<ElementType, ElementConfigGenerator>> = {
  // ... existing elements configuration
  
  [ElementType.STAR]: (t) => ({ // [!code ++]
    width: 100, // [!code ++]
    height: 100, // [!code ++]
    style: { // [!code ++]
      backgroundColor: 'transparent', // [!code ++]
      borderColor: '#000000' // [!code ++]
    } // [!code ++]
  }) // [!code ++]
};

// Note: The createNewElement function will automatically deep merge this with the base configuration
```

After completing the above steps, restart the development server, and you will see the new "Star" element in the sidebar and be able to drag it onto the canvas for editing.
