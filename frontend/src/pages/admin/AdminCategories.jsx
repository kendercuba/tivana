import AdminLayout from "../../components/admin/AdminLayout";
import AdminCategoryTree from "../../components/admin/AdminCategoryTree";

export default function AdminCategorias() {
  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold mb-4">Gestión de Categorías</h1>
      <AdminCategoryTree />
    </AdminLayout>
  );
}
