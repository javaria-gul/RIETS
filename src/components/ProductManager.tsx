import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Edit2, Trash2, Plus, X, Search, Filter, HelpCircle } from 'lucide-react';

interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  status: 'active' | 'inactive' | 'discontinued';
  price: string;
  createdAt: string;
}

export default function ProductManager() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Form states
  const [formSku, setFormSku] = useState('');
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('Electronics');
  const [formStatus, setFormStatus] = useState<'active' | 'inactive' | 'discontinued'>('active');
  const [formPrice, setFormPrice] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const categories = ['Electronics', 'Apparel', 'Grocery', 'Home', 'Beauty'];

  // 1. Fetch Products
  const { data, isLoading, isError } = useQuery({
    queryKey: ['products', page, search, categoryFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        search,
        category: categoryFilter
      });
      const res = await fetch(`/api/products?${params.toString()}`);
      if (!res.ok) throw new Error('Product catalogue error');
      return res.json() as Promise<{
        products: Product[];
        pagination: { total: number; page: number; limit: number; totalPages: number };
      }>;
    }
  });

  // 2. Add Mutation
  const addMutation = useMutation({
    mutationFn: async (newProd: Omit<Product, 'id' | 'createdAt'>) => {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProd)
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to create SKU');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setIsAddOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      setErrorMsg(err.message);
    }
  });

  // 3. Edit Mutation
  const editMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Product> }) => {
      const res = await fetch(`/api/products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to update SKU');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      // Invalidate anomalies to sync resolved/unresolved catalog names
      queryClient.invalidateQueries({ queryKey: ['anomalies'] });
      setIsEditOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      setErrorMsg(err.message);
    }
  });

  // 4. Delete/Retire Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/products/${id}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Retirement failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['anomalies'] });
    }
  });

  const resetForm = () => {
    setFormSku('');
    setFormName('');
    setFormCategory('Electronics');
    setFormStatus('active');
    setFormPrice('');
    setErrorMsg('');
    setSelectedProduct(null);
  };

  const handleOpenAdd = () => {
    resetForm();
    setIsAddOpen(true);
  };

  const handleOpenEdit = (p: Product) => {
    resetForm();
    setSelectedProduct(p);
    setFormSku(p.sku);
    setFormName(p.name);
    setFormCategory(p.category);
    setFormStatus(p.status);
    setFormPrice(p.price);
    setIsEditOpen(true);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formSku || !formName || !formPrice) {
      setErrorMsg('All config parameters are required.');
      return;
    }
    if (isNaN(parseFloat(formPrice))) {
      setErrorMsg('Price must be a valid numerical value.');
      return;
    }
    addMutation.mutate({
      sku: formSku,
      name: formName,
      category: formCategory,
      status: formStatus,
      price: formPrice
    });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    if (!formSku || !formName || !formPrice) {
      setErrorMsg('All parameters are required.');
      return;
    }
    if (isNaN(parseFloat(formPrice))) {
      setErrorMsg('Price must be a valid numerical value.');
      return;
    }
    editMutation.mutate({
      id: selectedProduct.id,
      data: {
        sku: formSku,
        name: formName,
        category: formCategory,
        status: formStatus,
        price: formPrice
      }
    });
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you absolutely sure you want to retire this product SKU from catalogue? Unresolved transaction anomalies tied to this product will retain operational historical records.')) {
      deleteMutation.mutate(id);
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400';
      case 'inactive':
        return 'bg-amber-500/10 border border-amber-500/30 text-amber-400';
      default:
        return 'bg-slate-500/10 border border-slate-500/30 text-slate-400';
    }
  };

  return (
    <div className="glass-panel p-6 rounded-xl relative overflow-hidden mb-8">
      <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/5 rounded-full blur-3xl -z-10" />

      {/* Header and Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
            <Plus className="h-5 w-5 text-purple-400" />
            Administrative SKU Catalog
          </h3>
          <p className="text-xs text-slate-400">Add, configure, and manage core product registry</p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="px-4 py-2 border border-purple-500/40 hover:border-purple-400 bg-purple-950/20 hover:bg-purple-500/20 text-purple-300 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm hover:shadow-purple-500/10 transition"
        >
          <Plus className="h-4 w-4" />
          Add New Product SKU
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
          <input 
            type="text"
            placeholder="Search catalog by SKU, product name..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full text-xs font-semibold pl-10 pr-4 py-2.5 rounded-lg bg-slate-900/80 border border-white/10 text-slate-300 placeholder:text-slate-650 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
          />
        </div>

        <div className="w-full sm:w-64">
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
            className="w-full text-xs font-semibold p-2.5 rounded-lg bg-slate-900/80 border border-white/10 text-slate-300 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
          >
            <option value="">ALL CATEGORIES</option>
            {categories.map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}
          </select>
        </div>
      </div>

      {/* Main Grid */}
      <div className="overflow-x-auto rounded-lg border border-white/5">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-900/80 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-white/5">
              <th className="py-3 px-4">SKU Code</th>
              <th className="py-3 px-4">Product Name</th>
              <th className="py-3 px-4">Category</th>
              <th className="py-3 px-4">Price</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-xs text-slate-300">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-500">
                  <div className="flex flex-col items-center gap-2">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-r-2 border-purple-400" />
                    <span className="font-semibold text-slate-400">Loading catalog registries...</span>
                  </div>
                </td>
              </tr>
            ) : isError ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-rose-400 font-semibold">
                  ❌ System catalogue connection error.
                </td>
              </tr>
            ) : !data || data.products.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-slate-500 font-medium">
                  No registered product SKUs matching current filters.
                </td>
              </tr>
            ) : (
              data.products.map((p) => (
                <tr key={p.id} className="hover:bg-white/2 transition-colors">
                  <td className="py-3.5 px-4 font-extrabold text-cyan-400 tech-font">{p.sku}</td>
                  <td className="py-3.5 px-4 font-bold text-slate-200">{p.name}</td>
                  <td className="py-3.5 px-4">
                    <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900 text-slate-400 uppercase border border-white/5">
                      {p.category}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-100 font-semibold tech-font">${parseFloat(p.price).toFixed(2)}</td>
                  <td className="py-3.5 px-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wide ${statusBadge(p.status)}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleOpenEdit(p)}
                        className="p-1 border border-white/5 hover:border-cyan-500/40 bg-slate-900 hover:bg-cyan-950/20 text-slate-400 hover:text-cyan-400 rounded transition"
                        title="Edit product parameters"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="p-1 border border-white/5 hover:border-rose-500/40 bg-slate-900 hover:bg-rose-950/20 text-slate-400 hover:text-rose-400 rounded transition"
                        title="Retire from catalog"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/5">
          <span className="text-xs text-slate-400">
            Showing <strong className="text-slate-200">{(page - 1) * 10 + 1}-{Math.min(page * 10, data.pagination.total)}</strong> of <strong className="text-slate-200">{data.pagination.total}</strong> products
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 border border-white/10 hover:bg-slate-800 rounded disabled:opacity-40 disabled:hover:bg-transparent text-slate-300 transition"
            >
              Back
            </button>

            <span className="text-xs font-semibold text-slate-300 px-2">
              Page {page} of {data.pagination.totalPages}
            </span>

            <button
              onClick={() => setPage(p => Math.min(data.pagination.totalPages, p + 1))}
              disabled={page === data.pagination.totalPages}
              className="p-1.5 border border-white/10 hover:bg-slate-800 rounded disabled:opacity-40 disabled:hover:bg-transparent text-slate-300 transition"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 📥 ADD PRODUCT GLASS MODAL */}
      {isAddOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel-accent w-full max-w-md p-6 rounded-xl relative overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6">
              <h4 className="font-extrabold text-slate-100 flex items-center gap-2">
                <Plus className="h-5 w-5 text-purple-400" />
                Registry New SKU Product
              </h4>
              <button 
                onClick={() => setIsAddOpen(false)}
                className="p-1 border border-white/10 hover:bg-white/5 rounded text-slate-400 hover:text-white transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">SKU identifier (Unique)</label>
                <input 
                  type="text"
                  placeholder="SKU-ELE-9410"
                  value={formSku}
                  onChange={(e) => setFormSku(e.target.value)}
                  className="w-full text-xs p-2.5 rounded bg-slate-900 border border-white/10 text-slate-200 focus:outline-none focus:border-purple-500"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Product Description / Name</label>
                <input 
                  type="text"
                  placeholder="Retail Tech LED Monitor"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full text-xs p-2.5 rounded bg-slate-900 border border-white/10 text-slate-200 focus:outline-none focus:border-purple-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Price ($ USD)</label>
                  <input 
                    type="text"
                    placeholder="299.99"
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    className="w-full text-xs p-2.5 rounded bg-slate-900 border border-white/10 text-slate-200 focus:outline-none focus:border-purple-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Structural Category</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full text-xs p-2.5 rounded bg-slate-900 border border-white/10 text-slate-300 focus:outline-none focus:border-purple-500"
                  >
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Active Status</label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as any)}
                  className="w-full text-xs p-2.5 rounded bg-slate-900 border border-white/10 text-slate-300 focus:outline-none focus:border-purple-500"
                >
                  <option value="active">Active (Standard sales enabled)</option>
                  <option value="inactive">Inactive (Mute catalog)</option>
                  <option value="discontinued">Discontinued (Archived catalog)</option>
                </select>
              </div>

              {errorMsg && <p className="text-xs text-rose-400 font-semibold">{errorMsg}</p>}

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 border border-white/10 hover:bg-slate-900 text-slate-300 text-xs font-semibold rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addMutation.isPending}
                  className="px-4 py-2 bg-purple-650 hover:bg-purple-650/80 text-white text-xs font-bold rounded shadow-lg shadow-purple-500/10"
                >
                  {addMutation.isPending ? 'Saving...' : 'Add SKU product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 📥 EDIT PRODUCT GLASS MODAL */}
      {isEditOpen && selectedProduct && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel-accent w-full max-w-md p-6 rounded-xl relative overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6">
              <h4 className="font-extrabold text-slate-100 flex items-center gap-2">
                <Edit2 className="h-5 w-5 text-cyan-450" />
                Configure SKU: {selectedProduct.sku}
              </h4>
              <button 
                onClick={() => setIsEditOpen(false)}
                className="p-1 border border-white/10 hover:bg-white/5 rounded text-slate-400 hover:text-white transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">SKU code (Modifiable)</label>
                <input 
                  type="text"
                  value={formSku}
                  onChange={(e) => setFormSku(e.target.value)}
                  className="w-full text-xs p-2.5 rounded bg-slate-900 border border-white/10 text-slate-200 focus:outline-none focus:border-cyan-550"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Product Description / Name</label>
                <input 
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full text-xs p-2.5 rounded bg-slate-900 border border-white/10 text-slate-200 focus:outline-none focus:border-cyan-550"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Price ($ USD)</label>
                  <input 
                    type="text"
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    className="w-full text-xs p-2.5 rounded bg-slate-900 border border-white/10 text-slate-200 focus:outline-none focus:border-cyan-550"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Structural Category</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full text-xs p-2.5 rounded bg-slate-900 border border-white/10 text-slate-300 focus:outline-none focus:border-cyan-550"
                  >
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Active Status</label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as any)}
                  className="w-full text-xs p-2.5 rounded bg-slate-900 border border-white/10 text-slate-300 focus:outline-none focus:border-cyan-550"
                >
                  <option value="active">Active (Standard sales enabled)</option>
                  <option value="inactive">Inactive (Mute catalog)</option>
                  <option value="discontinued">Discontinued (Archived catalog)</option>
                </select>
              </div>

              {errorMsg && <p className="text-xs text-rose-450 font-semibold">{errorMsg}</p>}

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="px-4 py-2 border border-white/10 hover:bg-slate-900 text-slate-300 text-xs font-semibold rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editMutation.isPending}
                  className="px-4 py-2 bg-cyan-650 hover:bg-cyan-650/80 text-white text-xs font-bold rounded shadow-lg shadow-cyan-500/10"
                >
                  {editMutation.isPending ? 'Updating...' : 'Save modifications'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
