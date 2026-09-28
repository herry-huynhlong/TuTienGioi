import { ItemAdminForm } from "../ItemAdminForm";

export default function NewItemPage() {
  return (
    <div>
      <header className="admin-page-head"><div><p className="eyebrow">Create</p><h1>Thêm Vật Phẩm</h1></div></header>
      <ItemAdminForm />
    </div>
  );
}
