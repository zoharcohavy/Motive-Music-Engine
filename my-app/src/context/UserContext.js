import { createContext, useContext, useState } from 'react'


const UserContext = createContext(null)
export const useUser = () => useContext(UserContext)


export function UserProvider({ children }){
const [user, setUser] = useState(null)


const login = (u) => setUser(u)
const logout = () => setUser(null)


return (
<UserContext.Provider value={{ user, login, logout }}>
{children}
</UserContext.Provider>
)
}