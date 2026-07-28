import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search,
  Download,
  Upload,
  Plus,
  UserPlus,
  Pencil,
  Trash2,
  Megaphone,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import TopBar from '../components/Layout/TopBar';
import LoadingButton from '../components/shared/LoadingButton';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import Pagination from '../components/shared/Pagination';
import EmptyState from '../components/shared/EmptyState';
import AddContactModal from '../components/Contacts/AddContactModal';
import EditContactModal from '../components/Contacts/EditContactModal';
import ImportModal from '../components/Contacts/ImportModal';
import { contacts, downloadBlob } from '../lib/api';

export default function ContactsPage() {
  const [contactList, setContactList] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [allTags, setAllTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editContact, setEditContact] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    try {
      const tag = selectedTags.length === 1 ? selectedTags[0] : '';
      const res = await contacts.list({ page, limit: 50, search, tags: tag });
      setContactList(res.data.contacts);
      setTotal(res.data.total);
      setPages(res.data.pages);
    } catch {
      toast.error('Failed to load contacts');
    } finally {
      setLoading(false);
    }
  }, [page, search, selectedTags]);

  const fetchTags = useCallback(async () => {
    try {
      const res = await contacts.tags();
      setAllTags(res.data);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  useEffect(() => {
    const ids = searchParams.get('ids');
    if (ids) {
      setSelectedIds(ids.split(',').map(Number));
    }
  }, [searchParams]);

  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (selectedIds.length === contactList.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(contactList.map((c) => c.id));
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await contacts.delete(deleteId);
      toast.success('Contact deleted');
      setDeleteId(null);
      fetchContacts();
      fetchTags();
    } catch {
      toast.error('Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    try {
      await contacts.bulkDelete(selectedIds);
      toast.success(`${selectedIds.length} contacts deleted`);
      setSelectedIds([]);
      fetchContacts();
      fetchTags();
    } catch {
      toast.error('Failed to delete contacts');
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleExport = async () => {
    try {
      const res = await contacts.export();
      downloadBlob(res.data, 'contacts_export.xlsx');
    } catch {
      toast.error('Export failed');
    }
  };

  const downloadTemplate = () => {
    const data = [
      { Name: 'John Doe', Phone: '9902622501', Company: 'Acme Inc', Email: 'john@acme.com', Tags: 'vip, customer' },
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Contacts');
    XLSX.writeFile(wb, 'contacts_template.xlsx');
  };

  const formatDate = (d) =>
    new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div>
      <TopBar title="Contacts">
        <span className="text-sm text-gray-500">{total} total</span>
      </TopBar>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
        <div className="p-4 flex flex-wrap items-center gap-3 border-b">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search contacts..."
              className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => {
                  setSelectedTags((prev) =>
                    prev.includes(tag) ? prev.filter((t) => t !== tag) : [tag]
                  );
                  setPage(1);
                }}
                className={`px-3 py-1 rounded-full text-xs font-medium border ${
                  selectedTags.includes(tag)
                    ? 'bg-accent text-white border-accent'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-accent'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
          <div className="flex gap-2 ml-auto">
            <LoadingButton variant="outline" onClick={downloadTemplate}>
              <Download size={16} /> Template
            </LoadingButton>
            <LoadingButton variant="outline" onClick={() => setShowImport(true)}>
              <Upload size={16} /> Upload Excel
            </LoadingButton>
            <LoadingButton variant="outline" onClick={handleExport}>
              <Download size={16} /> Export All
            </LoadingButton>
            <LoadingButton onClick={() => setShowAdd(true)}>
              <Plus size={16} /> Add Contact
            </LoadingButton>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : contactList.length === 0 ? (
          <EmptyState
            icon={UserPlus}
            title="No contacts yet"
            message="Add contacts manually or import from Excel"
            action={() => setShowAdd(true)}
            actionLabel="Add Contact"
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    <th className="px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={
                          contactList.length > 0 &&
                          selectedIds.length === contactList.length
                        }
                        onChange={toggleAll}
                      />
                    </th>
                    <th className="text-left px-4 py-3 font-medium">Name</th>
                    <th className="text-left px-4 py-3 font-medium">Phone</th>
                    <th className="text-left px-4 py-3 font-medium">Company</th>
                    <th className="text-left px-4 py-3 font-medium">Email</th>
                    <th className="text-left px-4 py-3 font-medium">Tags</th>
                    <th className="text-left px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {contactList.map((c) => (
                    <tr key={c.id} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(c.id)}
                          onChange={() => toggleSelect(c.id)}
                        />
                      </td>
                      <td className="px-4 py-3 font-medium">{c.name || '-'}</td>
                      <td className="px-4 py-3 font-mono text-xs">{c.phone}</td>
                      <td className="px-4 py-3">{c.company || '-'}</td>
                      <td className="px-4 py-3">{c.email || '-'}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(c.tags || []).map((t) => (
                            <span
                              key={t}
                              className="px-2 py-0.5 bg-accent/10 text-accent rounded-full text-xs"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{formatDate(c.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => setEditContact(c)}
                            className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => setDeleteId(c.id)}
                            className="p-1.5 rounded hover:bg-red-50 text-red-500"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pages={pages} onPageChange={setPage} />
          </>
        )}
      </div>

      {selectedIds.length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 sm:bottom-6 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:ml-0 lg:ml-32 bg-sidebar text-white rounded-xl shadow-2xl px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-6 z-50">
          <span className="font-medium text-center sm:text-left">{selectedIds.length} selected</span>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 flex-1 sm:flex-initial">
            <LoadingButton
              variant="primary"
              onClick={() =>
                navigate(`/campaigns?create=true&ids=${selectedIds.join(',')}`)
              }
              className="w-full sm:w-auto justify-center"
            >
              <Megaphone size={16} /> Create Campaign
            </LoadingButton>
            <LoadingButton
              variant="danger"
              onClick={handleBulkDelete}
              loading={bulkDeleting}
              className="w-full sm:w-auto justify-center"
            >
              <Trash2 size={16} /> Delete Selected
            </LoadingButton>
          </div>
        </div>
      )}

      <AddContactModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onSaved={() => {
          fetchContacts();
          fetchTags();
        }}
      />
      <EditContactModal
        open={!!editContact}
        contact={editContact}
        onClose={() => setEditContact(null)}
        onSaved={fetchContacts}
      />
      <ImportModal
        open={showImport}
        onClose={() => setShowImport(false)}
        onImported={() => {
          fetchContacts();
          fetchTags();
        }}
      />
      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Contact"
        message="Are you sure you want to delete this contact? This cannot be undone."
        confirmText="Delete"
        danger
        loading={deleting}
      />
    </div>
  );
}
