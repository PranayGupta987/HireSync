import './App.css'
import { SignedIn, SignedOut, SignInButton ,SignOutButton, UserButton } from '@clerk/clerk-react'

function App() {
  return (
    <>
      <h1>welcome to react app </h1>

      <SignedOut>
        <SignInButton mode="modal" >
          <button>Sign In</button>
        </SignInButton>
      </SignedOut>

      <SignedIn>
        <SignOutButton />
      </SignedIn>

      <UserButton />
    </>
  )
}

export default App
