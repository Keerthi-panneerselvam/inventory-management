import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Login from './Login'
import './App.css'

const CATEGORIES = ['Backdrops', 'Props', 'Lighting', 'Furniture', 'Fabrics', 'Frames/Stands', 'Decorative Items']
const CONDITIONS = ['Excellent', 'Good', 'Fair', 'Needs Repair']

function App() {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [items, setItems] = useState([])
  const [functions, setFunctions] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterCategory, setFilterCategory] = useState('All')
  const [editingId, setEditingId] = useState(null)
  const [activeTab, setActiveTab] = useState('inventory')
  const [showAddItemForm, setShowAddItemForm] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    quantity: '',
    category: 'Backdrops',
    price: '',
    color: '',
    size: '',
    condition: 'Excellent',
    location: ''
  })

  const [functionFormData, setFunctionFormData] = useState({
    functionName: '',
    clientName: '',
    clientPhone: '',
    functionDate: new Date().toISOString().split('T')[0],
    returnDate: '',
    venue: ''
  })

  const [selectedItems, setSelectedItems] = useState([])
  const [currentItemSelection, setCurrentItemSelection] = useState({
    itemId: '',
    quantity: ''
  })

  // Fetch items from Supabase
  const fetchItems = async () => {
    try {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .order('name')

      if (error) throw error
      setItems(data)
    } catch (error) {
      console.error('Error fetching items:', error.message)
      alert('Error loading items: ' + error.message)
    }
  }

  // Fetch functions with their items from Supabase
  const fetchFunctions = async () => {
    try {
      const { data: functionsData, error: functionsError } = await supabase
        .from('functions')
        .select(`
          *,
          function_items (
            quantity,
            items (
              id,
              name
            )
          )
        `)
        .order('function_date', { ascending: false })

      if (functionsError) throw functionsError

      // Transform data to match our component structure
      const transformedFunctions = functionsData.map(func => ({
        id: func.id,
        functionName: func.function_name,
        clientName: func.client_name,
        clientPhone: func.client_phone,
        functionDate: func.function_date,
        returnDate: func.return_date,
        actualReturnDate: func.actual_return_date,
        venue: func.venue,
        status: func.status,
        items: func.function_items.map(fi => ({
          itemId: fi.items.id,
          itemName: fi.items.name,
          quantity: fi.quantity
        }))
      }))

      setFunctions(transformedFunctions)
    } catch (error) {
      console.error('Error fetching functions:', error.message)
      alert('Error loading functions: ' + error.message)
    }
  }

  // Check authentication status
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user ?? null)
      setAuthLoading(false)
    }
    checkAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Initial data load
  useEffect(() => {
    if (user) {
      const loadData = async () => {
        setLoading(true)
        await Promise.all([fetchItems(), fetchFunctions()])
        setLoading(false)
      }
      loadData()
    }
  }, [user])

  const handleSubmit = async (e) => {
    e.preventDefault()

    try {
      if (editingId) {
        // Update existing item
        const { error } = await supabase
          .from('items')
          .update({
            name: formData.name,
            total_quantity: Number(formData.quantity),
            category: formData.category,
            price: Number(formData.price),
            color: formData.color,
            size: formData.size,
            condition: formData.condition,
            location: formData.location
          })
          .eq('id', editingId)

        if (error) throw error
        setEditingId(null)
      } else {
        // Insert new item
        const { error } = await supabase
          .from('items')
          .insert([{
            name: formData.name,
            total_quantity: Number(formData.quantity),
            assigned_quantity: 0,
            category: formData.category,
            price: Number(formData.price),
            color: formData.color,
            size: formData.size,
            condition: formData.condition,
            location: formData.location
          }])

        if (error) throw error
      }

      const wasEditing = editingId
      setFormData({
        name: '',
        quantity: '',
        category: 'Backdrops',
        price: '',
        color: '',
        size: '',
        condition: 'Excellent',
        location: ''
      })
      setEditingId(null)
      setShowAddItemForm(false)
      await fetchItems()
      alert(wasEditing ? 'Item updated successfully!' : 'Item added successfully!')
    } catch (error) {
      console.error('Error saving item:', error.message)
      alert('Error saving item: ' + error.message)
    }
  }

  const handleAddItemToFunction = () => {
    if (!currentItemSelection.itemId || !currentItemSelection.quantity) {
      alert('Please select an item and quantity')
      return
    }

    const item = items.find(i => i.id === Number(currentItemSelection.itemId))
    const availableQty = item.total_quantity - item.assigned_quantity
    const requestedQty = Number(currentItemSelection.quantity)

    const existingItem = selectedItems.find(si => si.itemId === Number(currentItemSelection.itemId))
    if (existingItem) {
      alert('This item is already added. Remove it first to change quantity.')
      return
    }

    if (requestedQty > availableQty) {
      alert(`Only ${availableQty} units available!`)
      return
    }

    setSelectedItems([
      ...selectedItems,
      {
        itemId: Number(currentItemSelection.itemId),
        itemName: item.name,
        quantity: requestedQty
      }
    ])

    setCurrentItemSelection({
      itemId: '',
      quantity: ''
    })
  }

  const handleRemoveItemFromFunction = (itemId) => {
    setSelectedItems(selectedItems.filter(si => si.itemId !== itemId))
  }

  const handleFunctionSubmit = async (e) => {
    e.preventDefault()

    if (selectedItems.length === 0) {
      alert('Please add at least one item to the function')
      return
    }

    try {
      // Insert function
      const { data: newFunction, error: functionError } = await supabase
        .from('functions')
        .insert([{
          function_name: functionFormData.functionName,
          client_name: functionFormData.clientName,
          client_phone: functionFormData.clientPhone,
          function_date: functionFormData.functionDate,
          return_date: functionFormData.returnDate,
          venue: functionFormData.venue,
          status: 'Ongoing'
        }])
        .select()
        .single()

      if (functionError) throw functionError

      // Insert function items
      const functionItems = selectedItems.map(item => ({
        function_id: newFunction.id,
        item_id: item.itemId,
        quantity: item.quantity
      }))

      const { error: itemsError } = await supabase
        .from('function_items')
        .insert(functionItems)

      if (itemsError) throw itemsError

      // Update assigned quantities
      for (const selectedItem of selectedItems) {
        const item = items.find(i => i.id === selectedItem.itemId)
        const { error: updateError } = await supabase
          .from('items')
          .update({
            assigned_quantity: item.assigned_quantity + selectedItem.quantity
          })
          .eq('id', selectedItem.itemId)

        if (updateError) throw updateError
      }

      setFunctionFormData({
        functionName: '',
        clientName: '',
        clientPhone: '',
        functionDate: new Date().toISOString().split('T')[0],
        returnDate: '',
        venue: ''
      })
      setSelectedItems([])
      await Promise.all([fetchItems(), fetchFunctions()])
      alert('Function booked successfully!')
      setActiveTab('history')
    } catch (error) {
      console.error('Error booking function:', error.message)
      alert('Error booking function: ' + error.message)
    }
  }

  const handleReturn = async (functionId) => {
    try {
      const func = functions.find(f => f.id === functionId)

      // Update function status
      const { error: functionError } = await supabase
        .from('functions')
        .update({
          status: 'Completed',
          actual_return_date: new Date().toISOString().split('T')[0]
        })
        .eq('id', functionId)

      if (functionError) throw functionError

      // Return all items
      for (const funcItem of func.items) {
        const item = items.find(i => i.id === funcItem.itemId)
        const { error: updateError } = await supabase
          .from('items')
          .update({
            assigned_quantity: item.assigned_quantity - funcItem.quantity
          })
          .eq('id', funcItem.itemId)

        if (updateError) throw updateError
      }

      await Promise.all([fetchItems(), fetchFunctions()])
      alert('All items returned successfully!')
    } catch (error) {
      console.error('Error returning items:', error.message)
      alert('Error returning items: ' + error.message)
    }
  }

  const handleEdit = (item) => {
    setEditingId(item.id)
    setFormData({
      name: item.name,
      quantity: item.total_quantity.toString(),
      category: item.category,
      price: item.price.toString(),
      color: item.color,
      size: item.size,
      condition: item.condition,
      location: item.location
    })
    setShowAddItemForm(true)
  }

  const handleDelete = async (id) => {
    const item = items.find(i => i.id === id)
    if (item.assigned_quantity > 0) {
      alert('Cannot delete item with ongoing functions!')
      return
    }

    if (!window.confirm('Are you sure you want to delete this item?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('items')
        .delete()
        .eq('id', id)

      if (error) throw error

      await fetchItems()
      alert('Item deleted successfully!')
    } catch (error) {
      console.error('Error deleting item:', error.message)
      alert('Error deleting item: ' + error.message)
    }
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setShowAddItemForm(false)
    setFormData({
      name: '',
      quantity: '',
      category: 'Backdrops',
      price: '',
      color: '',
      size: '',
      condition: 'Excellent',
      location: ''
    })
  }

  const handleLogin = (loggedInUser) => {
    setUser(loggedInUser)
  }

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      alert('Error logging out: ' + error.message)
    } else {
      setUser(null)
      setItems([])
      setFunctions([])
    }
  }

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (item.color && item.color.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesCategory = filterCategory === 'All' || item.category === filterCategory
    return matchesSearch && matchesCategory
  })

  const ongoingFunctions = functions.filter(f => f.status === 'Ongoing')
  const totalAssignedItems = ongoingFunctions.reduce((sum, f) =>
    sum + f.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0
  )

  // Show loading while checking authentication
  if (authLoading) {
    return (
      <div className="app">
        <div className="header">
          <h1>Subbu Decorators</h1>
          <p className="subtitle">Loading...</p>
        </div>
      </div>
    )
  }

  // Show login page if not authenticated
  if (!user) {
    return <Login onLogin={handleLogin} />
  }

  // Show loading while fetching data
  if (loading) {
    return (
      <div className="app">
        <div className="header">
          <h1>Subbu Decorators</h1>
          <p className="subtitle">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <div className="header">
        <div className="header-content">
          <div>
            <h1>Subbu Decorators</h1>
            <p className="subtitle">Function Inventory Management System</p>
          </div>
          <button onClick={handleLogout} className="logout-btn">
            Logout
          </button>
        </div>
      </div>

      <div className="tab-navigation">
        <div className="tab-buttons">
          <button
            className={`tab-button ${activeTab === 'inventory' ? 'active' : ''}`}
            onClick={() => setActiveTab('inventory')}
          >
            <span className="tab-icon">📦</span>
            Inventory
          </button>
          <button
            className={`tab-button ${activeTab === 'book' ? 'active' : ''}`}
            onClick={() => setActiveTab('book')}
          >
            <span className="tab-icon">🎉</span>
            Book Function
          </button>
          <button
            className={`tab-button ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <span className="tab-icon">📋</span>
            History
          </button>
        </div>
      </div>

      <div className="content-area">
        <div className={`tab-content ${activeTab === 'book' ? 'active' : ''}`}>
          <div className="card">
          <h2>Book Items for Function</h2>
          <form onSubmit={handleFunctionSubmit}>
            <div className="form-group">
              <label>Function Name/Type: *</label>
              <input
                type="text"
                value={functionFormData.functionName}
                onChange={(e) => setFunctionFormData({ ...functionFormData, functionName: e.target.value })}
                placeholder="e.g., Wedding Reception, Birthday Party"
                required
              />
            </div>

            <div className="form-group">
              <label>Client Name: *</label>
              <input
                type="text"
                value={functionFormData.clientName}
                onChange={(e) => setFunctionFormData({ ...functionFormData, clientName: e.target.value })}
                placeholder="Enter client name"
                required
              />
            </div>

            <div className="form-group">
              <label>Client Phone: *</label>
              <input
                type="tel"
                value={functionFormData.clientPhone}
                onChange={(e) => setFunctionFormData({ ...functionFormData, clientPhone: e.target.value })}
                placeholder="Enter phone number"
                required
              />
            </div>

            <div className="form-group">
              <label>Venue:</label>
              <input
                type="text"
                value={functionFormData.venue}
                onChange={(e) => setFunctionFormData({ ...functionFormData, venue: e.target.value })}
                placeholder="Function venue location"
              />
            </div>

            <div className="form-group">
              <label>Function Date: *</label>
              <input
                type="date"
                value={functionFormData.functionDate}
                onChange={(e) => setFunctionFormData({ ...functionFormData, functionDate: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label>Expected Return Date: *</label>
              <input
                type="date"
                value={functionFormData.returnDate}
                onChange={(e) => setFunctionFormData({ ...functionFormData, returnDate: e.target.value })}
                required
              />
            </div>

            <div className="items-section">
              <h3>Add Items for this Function</h3>
              <div className="add-item-row">
                <div className="form-group">
                  <label>Select Item:</label>
                  <select
                    value={currentItemSelection.itemId}
                    onChange={(e) => setCurrentItemSelection({ ...currentItemSelection, itemId: e.target.value })}
                  >
                    <option value="">Choose an item...</option>
                    {items.map(item => {
                      const available = item.total_quantity - item.assigned_quantity
                      return (
                        <option key={item.id} value={item.id}>
                          {item.name} - Available: {available}/{item.total_quantity}
                        </option>
                      )
                    })}
                  </select>
                </div>

                <div className="form-group">
                  <label>Quantity:</label>
                  <input
                    type="number"
                    value={currentItemSelection.quantity}
                    onChange={(e) => setCurrentItemSelection({ ...currentItemSelection, quantity: e.target.value })}
                    min="1"
                    placeholder="Qty"
                  />
                </div>

                <button type="button" onClick={handleAddItemToFunction} className="add-item-to-list-btn">
                  Add Item
                </button>
              </div>

              {selectedItems.length > 0 && (
                <div className="selected-items-list">
                  <h4>Selected Items ({selectedItems.length}):</h4>
                  <table className="selected-items-table">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Quantity</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedItems.map((item) => (
                        <tr key={item.itemId}>
                          <td>{item.itemName}</td>
                          <td>{item.quantity}</td>
                          <td>
                            <button
                              type="button"
                              onClick={() => handleRemoveItemFromFunction(item.itemId)}
                              className="remove-item-btn"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="form-buttons">
              <button type="submit">Book Function</button>
              <button type="button" onClick={() => {
                setFunctionFormData({
                  functionName: '',
                  clientName: '',
                  clientPhone: '',
                  functionDate: new Date().toISOString().split('T')[0],
                  returnDate: '',
                  venue: ''
                })
                setSelectedItems([])
                setCurrentItemSelection({ itemId: '', quantity: '' })
              }} className="cancel-btn">
                Reset Form
              </button>
            </div>
          </form>
          </div>
        </div>

        <div className={`tab-content ${activeTab === 'history' ? 'active' : ''}`}>
          <div className="card">
          <h2>Function History</h2>
            {functions.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📋</div>
                <p>No functions booked yet.</p>
              </div>
            ) : (
              <div className="table-container">
              {functions.map(func => (
                <div key={func.id} className="function-card">
                  <div className="function-header">
                    <div className="function-info">
                      <h3>{func.functionName}</h3>
                      <div className="function-details">
                        <span><strong>Client:</strong> {func.clientName} ({func.clientPhone})</span>
                        <span><strong>Date:</strong> {func.functionDate}</span>
                        <span><strong>Venue:</strong> {func.venue || '-'}</span>
                        <span><strong>Expected Return:</strong> {func.returnDate}</span>
                        {func.actualReturnDate && (
                          <span><strong>Actual Return:</strong> {func.actualReturnDate}</span>
                        )}
                      </div>
                    </div>
                    <div className="function-status">
                      <span className={`status-badge ${func.status.toLowerCase()}`}>
                        {func.status}
                      </span>
                      {func.status === 'Ongoing' && (
                        <button onClick={() => handleReturn(func.id)} className="return-btn">
                          Mark All Returned
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="function-items">
                    <h4>Items Used:</h4>
                    <table className="inventory-table">
                      <thead>
                        <tr>
                          <th>Item Name</th>
                          <th>Quantity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {func.items.map((item, index) => (
                          <tr key={index}>
                            <td>{item.itemName}</td>
                            <td className="quantity">{item.quantity}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
              </div>
            )}
          </div>
        </div>

        <div className={`tab-content ${activeTab === 'inventory' ? 'active' : ''}`}>
      {showAddItemForm && (
        <div className="card">
          <h2>{editingId ? 'Edit Item' : 'Add New Item to Inventory'}</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Item Name: *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Floral Wall Backdrop"
                required
              />
            </div>

            <div className="form-group">
              <label>Category: *</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              >
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Color/Theme:</label>
              <input
                type="text"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                placeholder="e.g., Pink & White"
              />
            </div>

            <div className="form-group">
              <label>Size/Dimensions:</label>
              <input
                type="text"
                value={formData.size}
                onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                placeholder="e.g., 8x8 ft"
              />
            </div>

            <div className="form-group">
              <label>Total Quantity: *</label>
              <input
                type="number"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                min="0"
                required
              />
            </div>

            <div className="form-group">
              <label>Value/Price (₹): *</label>
              <input
                type="number"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                min="0"
                required
              />
            </div>

            <div className="form-group">
              <label>Condition:</label>
              <select
                value={formData.condition}
                onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
              >
                {CONDITIONS.map(cond => (
                  <option key={cond} value={cond}>{cond}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Storage Location:</label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="e.g., Warehouse A"
              />
            </div>

            <div className="form-buttons">
              <button type="submit">{editingId ? 'Update Item' : 'Add Item'}</button>
              <button type="button" onClick={handleCancelEdit} className="cancel-btn">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <div className="section-header">
          <h2>Current Inventory</h2>
          <button
            onClick={() => {
              setShowAddItemForm(!showAddItemForm)
              if (showAddItemForm) {
                handleCancelEdit()
              }
            }}
            className="add-item-header-btn"
          >
            {showAddItemForm ? '← Back to Inventory' : '➕ Add New Item'}
          </button>
        </div>

        <div className="filters">
          <div className="search-box">
            <label>Search:</label>
            <input
              type="text"
              placeholder="Search by name or color..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="category-filter">
            <label>Filter by Category:</label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="All">All Categories</option>
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="stats">
          <div className="stat-card">
            <span className="stat-label">Total Items:</span>
            <span className="stat-value">{filteredItems.length}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Total Inventory Value:</span>
            <span className="stat-value">₹{filteredItems.reduce((sum, item) => sum + (item.total_quantity * item.price), 0).toFixed(2)}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Items Out for Functions:</span>
            <span className="stat-value">{totalAssignedItems}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Ongoing Functions:</span>
            <span className="stat-value">{ongoingFunctions.length}</span>
          </div>
        </div>

        <div className="table-container">
          <table className="inventory-table">
            <thead>
              <tr>
                <th>Item Name</th>
                <th>Category</th>
                <th>Color/Theme</th>
                <th>Size</th>
                <th>Total Qty</th>
                <th>Available</th>
                <th>Out for Functions</th>
                <th>Value</th>
                <th>Condition</th>
                <th>Location</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan="11" style={{ textAlign: 'center', padding: '30px' }}>
                    No items found. Add your first item above!
                  </td>
                </tr>
              ) : (
                filteredItems.map(item => {
                  const available = item.total_quantity - item.assigned_quantity
                  return (
                    <tr key={item.id}>
                      <td className="item-name">{item.name}</td>
                      <td>
                        <span className="category-badge">{item.category}</span>
                      </td>
                      <td>{item.color}</td>
                      <td>{item.size}</td>
                      <td className="quantity">{item.total_quantity}</td>
                      <td className={available === 0 ? 'quantity-zero' : 'quantity-available'}>
                        {available}
                      </td>
                      <td className={item.assigned_quantity > 0 ? 'quantity-assigned' : ''}>
                        {item.assigned_quantity}
                      </td>
                      <td>₹{item.price.toFixed(2)}</td>
                      <td>
                        <span className={`condition-badge ${item.condition.toLowerCase().replace(/\s+/g, '-')}`}>
                          {item.condition}
                        </span>
                      </td>
                      <td>{item.location}</td>
                      <td className="actions">
                        <button onClick={() => handleEdit(item)} className="edit-btn">Edit</button>
                        <button onClick={() => handleDelete(item.id)} className="delete-btn">Delete</button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
        </div>
      </div>
    </div>
  )
}

export default App
