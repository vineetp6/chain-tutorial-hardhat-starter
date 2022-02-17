import { expect } from "chai"
import { ethers } from "hardhat"
import { Contract, Signer, ContractInterface } from "ethers"
import { TransactionResponse, TransactionReceipt } from "@ethersproject/providers"
import { LogDescription } from "@ethersproject/abi"
import { BigNumberish } from "ethers"
import { BytesLike } from "@ethersproject/bytes"

// https://medium.com/linum-labs/everything-you-ever-wanted-to-know-about-events-and-logs-on-ethereum-fec84ea7d0a5

describe("Blog (Event)", async function () {
  let oriblogName = "My blog"
  let blog:Contract
  let owner:Signer
  let account1:Signer

  const blogTitle = "My first post"
  const contentHash = ethers.utils.id("12345")
  const newBlogTitle = "My updated post"
  const newContentHash = ethers.utils.id("23456")

  const iface:ContractInterface = new ethers.utils.Interface(
    ["event PostCreated(uint id, string title, bytes32 contentHash)",
     "event PostUpdated(uint id, string title, bytes32 contentHash, bool published)"])

  beforeEach(async function () {
    [owner, account1] = await ethers.getSigners()
    const Blog = await ethers.getContractFactory("Blog")
    blog = await Blog.deploy(oriblogName)
    await blog.deployed()
  })

  it("Should log event PostCreated correctly", async function () {

    let tx:TransactionResponse
    let receipt:TransactionReceipt
    let aevent:LogDescription

    //creat post
    tx = await blog.createPost(blogTitle, contentHash)
    receipt = await ethers.provider.getTransactionReceipt(tx.hash)

    aevent = iface.parseLog(receipt.logs[0])
    expect(aevent.name).to.be.equal("PostCreated")
    expect(aevent.args.title).to.equal(blogTitle)
    expect(aevent.args.id).to.equal(1)//id start from 1
  })

  it("Should log event PostUpdated correctly", async function () {
    let tx:TransactionResponse
    let receipt:TransactionReceipt
    let aevent:LogDescription

    //create post
    tx = await blog.createPost(blogTitle, contentHash)

    receipt = await ethers.provider.getTransactionReceipt(tx.hash)
    aevent = iface.parseLog(receipt.logs[0])
    expect(aevent.args.id).to.equal(1)//id start from 1

    //update post: change title and contentHash 
    tx = await blog.updatePost(aevent.args.id, newBlogTitle, newContentHash, true)
    receipt = await ethers.provider.getTransactionReceipt(tx.hash)

    // aevent = iface.parseLog(receipt.logs[0])
    //in another way (ethers.js v5)
    const data = receipt.logs[0].data
    const topics = receipt.logs[0].topics
    const event = iface.decodeEventLog("PostUpdated", data, topics)
    expect(event.title).to.equal(newBlogTitle)
    expect(event.id).to.equal(1)//should remain to be the same 1
  })


  // ref: https://docs.ethers.io/v4/cookbook-testing.html#contract-events

  it("Should emit event PostCreated correctly", async function () {
    console.log("Waiting for PostCreated event for *1 minute*...")
    interface PostCreated {
      id: BigNumberish,
      title: string,
      contentHash: BytesLike
    }  

    let postCreatedEvent = new Promise<PostCreated>((resolve, reject) => {
        blog.on('PostCreated', (id, title, contentHash,event) => {
            event.removeListener()

            resolve({
                id: id,
                title: title,
                contentHash: contentHash
            })
        })

        setTimeout(() => {
            reject(new Error('timeout'))
        }, 60000)   //1 min
    })

    await blog.createPost(blogTitle, contentHash)

    let event:PostCreated = await postCreatedEvent

    expect(event.title).to.equal(blogTitle)
    expect(event.id).to.equal(1)//should remain to be the same 1
  })

  it("Should emit event PostUpdated correctly", async function () {
    console.log("Waiting for PostUpdated event for *1 minute*...")
    interface PostUpdated {
      id: BigNumberish,
      title: string,
      contentHash: BytesLike,
      published: Boolean
    }  

    let postUpdatedEvent = new Promise<PostUpdated>((resolve, reject) => {
        blog.on('PostUpdated', (id, title,contentHash,published,event) => {
            event.removeListener()

            resolve({
                id: id,
                title: title,
                contentHash: contentHash,
                published: published 
            })
        })

        setTimeout(() => {
            reject(new Error('timeout'))
        }, 60000)   //1 min
    })

    await blog.createPost(blogTitle, contentHash)
    await blog.updatePost(1, newBlogTitle, newContentHash, true)

    let event:PostUpdated = await postUpdatedEvent

    expect(event.title).to.equal(newBlogTitle)
    expect(event.id).to.equal(1)//should remain to be the same 1
  })


  it("Should create a post without event for test", async function () {
    const blogTitle = "My first post"
    const contentHash = ethers.utils.id("12345")

    await blog.createPostWithoutEvent(blogTitle, contentHash)

    const posts = await blog.fetchPosts()

    //this is the first post, so it is posts[0]
    expect(posts[0].title).to.equal(blogTitle)
    expect(posts[0].contentHash).to.equal(contentHash)
    expect(posts[0].id).to.equal(1)
  })  

})