---
name: react-vite-guidelines
description: Frontend development guidelines for React 19 + TypeScript + Vite + Tailwind CSS. Modern patterns including Suspense, lazy loading, file organization, Tailwind styling, performance optimization, and TypeScript best practices. Use when creating components, pages, features, styling, or working with frontend code.
---

# React + Vite + Tailwind Guidelines

## Purpose

Comprehensive guide for modern React development with Vite and Tailwind CSS, emphasizing Suspense-based patterns, lazy loading, proper file organization, and performance optimization.

## When to Use This Skill

- Creating new components or pages
- Building new features
- Styling components with Tailwind CSS
- Setting up Vite configuration
- Performance optimization
- Organizing frontend code
- TypeScript best practices

---

## Quick Start

### New Component Checklist

Creating a component? Follow this checklist:

- [ ] Use `React.FC<Props>` pattern with TypeScript
- [ ] Lazy load if heavy component: `React.lazy(() => import())`
- [ ] Wrap in `<Suspense>` for loading states
- [ ] Use Tailwind classes for styling
- [ ] Follow mobile-first responsive design
- [ ] Use `useCallback` for event handlers passed to children
- [ ] Default export at bottom
- [ ] Component files in PascalCase: `MyComponent.tsx`
- [ ] Use CSS classes for reusable styles when needed

### New Feature Checklist

Creating a feature? Set up this structure:

- [ ] Create `features/{feature-name}/` directory (if applicable)
- [ ] Create subdirectories: `components/`, `hooks/`, `utils/`, `types/`
- [ ] Set up TypeScript types in `types/`
- [ ] Lazy load feature components
- [ ] Use Suspense boundaries
- [ ] Export public API from feature `index.ts`

---

## Common Imports Cheatsheet

```typescript
// React & Lazy Loading
import React, { useState, useCallback, useMemo, Suspense } from 'react';
const Heavy = React.lazy(() => import('./Heavy'));

// Vite-specific
import.meta.env.VITE_API_KEY

// Types
import type { MyType } from './types';
```

---

## Topic Guides

### 🎨 Component Patterns

**Modern React components use:**
- `React.FC<Props>` for type safety
- `React.lazy()` for code splitting
- `Suspense` for loading states
- Named const + default export pattern

**Key Concepts:**
- Lazy load heavy components (charts, editors, data-heavy components)
- Always wrap lazy components in Suspense
- Use loading fallback UI (simple spinner or skeleton)
- Component structure: Props → Hooks → Handlers → Render → Export

**Example:**
```typescript
import React, { Suspense } from 'react';

const HeavyComponent = React.lazy(() => import('./HeavyComponent'));

export const MyComponent: React.FC = () => {
  return (
    <Suspense fallback={<div className="animate-pulse">Loading...</div>}>
      <HeavyComponent />
    </Suspense>
  );
};

export default MyComponent;
```

---

### 📁 File Organization

**features/ pattern (if applicable):**
- Domain-specific code organized by feature
- Each feature is self-contained

**Feature Subdirectories:**
```
features/
  my-feature/
    components/   # Feature components
    hooks/        # Custom hooks
    utils/        # Utility functions
    types/        # TypeScript types
    index.ts      # Public exports
```

**For simpler projects:**
```
src/
  components/   # All components
  hooks/        # Custom hooks
  utils/        # Utility functions
  types/        # TypeScript types
  index.tsx     # Main entry point
```

---

### 🎨 Styling with Tailwind

**Primary Method: Tailwind Classes**

```typescript
// Simple component
export const Button: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  return (
    <button
      onClick={onClick}
      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
    >
      Click Me
    </button>
  );
};
```

**Responsive Design (Mobile-First):**
```typescript
<div className="
  text-sm          /* mobile */
  md:text-base     /* tablet */
  lg:text-lg       /* desktop */
  px-4             /* mobile */
  md:px-8          /* tablet */
  lg:px-16         /* desktop */
">
  Responsive content
</div>
```

**Complex Styles: Use className Utilities**
```typescript
import { cn } from '@/lib/utils'; // classnames utility

export const Card: React.FC<{ variant?: 'primary' | 'secondary' }> = ({ variant = 'primary' }) => {
  return (
    <div className={cn(
      "rounded-lg shadow-md p-6",
      variant === 'primary' && "bg-blue-50 border-blue-200",
      variant === 'secondary' && "bg-gray-50 border-gray-200"
    )}>
      Content
    </div>
  );
};
```

**When to Extract to CSS:**
- Repeated complex combinations (>5 classes)
- Animation keyframes
- Custom pseudo-selectors
- Use `@apply` in CSS files for Tailwind utilities

---

### ⏳ Loading & Error States

**CRITICAL RULE: Use Suspense Boundaries**

```typescript
// ❌ AVOID - Can cause layout shift
const MyComponent: React.FC = () => {
  const [loading, setLoading] = useState(true);

  if (loading) {
    return <div>Loading...</div>;
  }

  return <div>Content</div>;
};

// ✅ PREFER - Consistent layout
const MyComponent: React.FC = () => {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <DataComponent />
    </Suspense>
  );
};
```

**Loading UI Patterns:**
```typescript
// Simple spinner
<div className="flex items-center justify-center h-screen">
  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
</div>

// Skeleton screen
<div className="animate-pulse space-y-4">
  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
</div>
```

---

### ⚡ Performance

**Optimization Patterns:**
- `useMemo`: Expensive computations (filter, sort, map large arrays)
- `useCallback`: Event handlers passed to children
- `React.memo`: Expensive components that re-render frequently
- Debounced search (300-500ms)
- Memory leak prevention (cleanup in useEffect)

**Example:**
```typescript
import React, { useState, useMemo, useCallback } from 'react';

export const DataList: React.FC<{ items: Item[] }> = ({ items }) => {
  const [filter, setFilter] = useState('');

  // Memoize expensive filtering
  const filteredItems = useMemo(() => {
    return items.filter(item =>
      item.name.toLowerCase().includes(filter.toLowerCase())
    );
  }, [items, filter]);

  // Memoize callback
  const handleClick = useCallback((id: number) => {
    console.log('Clicked:', id);
  }, []);

  return (
    <div className="space-y-2">
      <input
        type="text"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="border rounded px-3 py-2"
        placeholder="Filter..."
      />
      {filteredItems.map(item => (
        <div key={item.id} onClick={() => handleClick(item.id)}>
          {item.name}
        </div>
      ))}
    </div>
  );
};
```

---

### 📘 TypeScript

**Standards:**
- Strict mode, no `any` type
- Explicit return types on functions
- Type imports: `import type { User } from './types'`
- Component prop interfaces with JSDoc

**Example:**
```typescript
/**
 * A card component that displays user information
 * @param user - The user object to display
 * @param onEdit - Optional callback when edit button is clicked
 */
interface UserCardProps {
  user: {
    id: number;
    name: string;
    email: string;
  };
  onEdit?: (userId: number) => void;
}

export const UserCard: React.FC<UserCardProps> = ({ user, onEdit }) => {
  const handleEdit = (): void => {
    if (onEdit) {
      onEdit(user.id);
    }
  };

  return (
    <div className="border rounded p-4">
      <h3 className="text-lg font-semibold">{user.name}</h3>
      <p className="text-gray-600">{user.email}</p>
      {onEdit && (
        <button onClick={handleEdit} className="mt-2 text-blue-500">
          Edit
        </button>
      )}
    </div>
  );
};
```

---

### 🔧 Vite Configuration

**Key Vite Features:**

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});
```

**Environment Variables:**
- Use `VITE_` prefix for client-exposed vars
- Access via `import.meta.env.VITE_API_KEY`
- Never commit `.env.local` files

---

## Core Principles

1. **Lazy Load Heavy Components**: Use React.lazy for code splitting
2. **Suspense for Loading**: Use Suspense boundaries, not conditional rendering
3. **Tailwind for Styling**: Utility-first, mobile-first responsive design
4. **TypeScript Strict Mode**: No `any`, explicit types
5. **Component Organization**: Clear file structure, export public APIs
6. **Performance First**: useMemo, useCallback, React.memo when needed
7. **Environment Variables**: Use VITE_ prefix for client vars
8. **Build Optimization**: Vite handles HMR and tree-shaking automatically

---

## Quick Reference: File Structure

```
src/
  components/
    Button.tsx
    Card.tsx
    LoadingSpinner.tsx

  features/ (optional)
    pattern-management/
      components/
        PatternCard.tsx
      hooks/
        usePatterns.ts
      types/
        index.ts
      index.ts

  hooks/
    useDebounce.ts
    useLocalStorage.ts

  utils/
    cn.ts          # classnames utility
    api.ts         # API client

  types/
    index.ts       # Shared types

  index.tsx        # Entry point
  App.tsx          # Root component
```

---

## Modern Component Template (Quick Copy)

```typescript
import React, { useState, useCallback } from 'react';

interface MyComponentProps {
  id: number;
  title: string;
  onAction?: () => void;
}

/**
 * Component description
 */
export const MyComponent: React.FC<MyComponentProps> = ({ id, title, onAction }) => {
  const [state, setState] = useState<string>('');

  const handleAction = useCallback((): void => {
    setState('updated');
    onAction?.();
  }, [onAction]);

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold mb-4">{title}</h2>
      <button
        onClick={handleAction}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
      >
        Action
      </button>
    </div>
  );
};

export default MyComponent;
```

---

**Skill Status**: Adapted for React 19 + Vite + Tailwind CSS stack
